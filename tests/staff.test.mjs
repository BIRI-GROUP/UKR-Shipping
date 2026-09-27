import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createHandler, hashPassword, verifyPassword } from '../services/staff/server.mjs';
import { testStore } from '../services/staff/store.mjs';
process.env.NODE_ENV = 'test';
const password = 'Local-test-only-482!';
const digest = x => createHash('sha256').update(x).digest('hex');

test('staff authentication and authorization integration', async t => {
  const store = await testStore();
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  server.on('request', await createHandler({ store, origin, secure: false, ownerEmail: 'owner@example.test', setupTokenHash: digest('setup-test-token'), setupExpires: Date.now() + 60000 }));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); });
  async function request(path, { method = 'GET', data, account, headers = {} } = {}) {
    const response = await fetch(origin + '/api' + path, { method, headers: { Origin: origin, ...(data ? { 'Content-Type': 'application/json' } : {}), ...(account ? { Cookie: account.cookie, 'X-CSRF-Token': account.csrf } : {}), ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  async function login(address, pw = password) {
    const result = await request('/login', { method: 'POST', data: { email: address, password: pw } });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.match(result.cookie, /HttpOnly; SameSite=Strict/);
    return { ...result.data, cookie: result.cookie.split(';')[0] };
  }
  let owner;
  await t.test('owner setup requires exact identity and token and is single use', async () => {
    assert.equal((await request('/me')).status, 401);
    assert.equal((await request('/setup', { method: 'POST', data: { email: 'intruder@example.test', name: 'Owner', token: 'setup-test-token', password } })).status, 403);
    assert.equal((await request('/setup', { method: 'POST', data: { email: 'OWNER@example.test', name: 'Owner Test', token: 'setup-test-token', password } })).status, 201);
    assert.equal((await request('/setup', { method: 'POST', data: { email: 'owner@example.test', name: 'Owner', token: 'setup-test-token', password } })).status, 409);
    const saved = (await store.query('SELECT * FROM staff_users')).rows[0];
    assert.notEqual(saved.password_hash, password);
    assert.equal(await verifyPassword(password, saved.password_hash), true);
    owner = await login('owner@example.test');
    assert.equal((await request('/me', { account: owner })).data.user.role, 'super_admin');
  });
  await t.test('origin, CSRF, login failure and unknown roles fail closed', async () => {
    const data = { name: 'No', email: 'no@example.test', role: 'sales' };
    assert.equal((await request('/invites', { method: 'POST', data, account: owner, headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await request('/invites', { method: 'POST', data, account: owner, headers: { 'X-CSRF-Token': 'wrong' } })).status, 403);
    assert.equal((await request('/invites', { method: 'POST', data: { ...data, role: 'toString' }, account: owner })).status, 400);
    assert.equal((await request('/login', { method: 'POST', data: { email: 'owner@example.test', password: 'incorrect-password' } })).status, 401);
    assert.equal((await request('/login', { method: 'POST', data: { email: "' OR 1=1 --", password } })).status, 401);
  });
  let sales, colleague, manager, warehouse, accounts, management;
  await t.test('owner invitations bind identity and cannot be reused', async () => {
    const result = await request('/invites', { method: 'POST', account: owner, data: { name: 'Sales Test', email: 'sales@example.test', role: 'sales' } });
    assert.equal(result.status, 201);
    const token = new URL(result.data.link).hash.slice('#invite='.length);
    const saved = (await store.query('SELECT * FROM staff_invites')).rows[0]; assert.notEqual(saved.token_hash, token);
    assert.equal((await request('/accept-invite', { method: 'POST', data: { token, email: 'wrong@example.test', password } })).status, 403);
    assert.equal((await request('/accept-invite', { method: 'POST', data: { token, email: 'sales@example.test', password } })).status, 201);
    assert.equal((await request('/accept-invite', { method: 'POST', data: { token, email: 'sales@example.test', password } })).status, 403);
    sales = await login('sales@example.test');
    const hash = await hashPassword(password);
    for (const [id, role] of [['colleague','sales'],['manager','sales_manager'],['warehouse','china_warehouse'],['accounts','accounts'],['management','management']]) {
      await store.query('INSERT INTO staff_users (id,email,name,role,password_hash,active,created_at) VALUES ($1,$2,$1,$3,$4,1,$5)', [id, id + '@example.test', role, hash, Date.now()]);
    }
    colleague = await login('colleague@example.test'); manager = await login('manager@example.test'); warehouse = await login('warehouse@example.test'); accounts = await login('accounts@example.test'); management = await login('management@example.test');
  });
  let quoteId;
  await t.test('department and assignment restrictions hold against direct API calls', async () => {
    assert.equal((await request('/users', { account: sales })).status, 403);
    assert.equal((await request('/audit', { account: sales })).status, 403);
    assert.equal((await request('/work?module=finance', { account: warehouse })).status, 403);
    assert.equal((await request('/work?module=quotes', { account: warehouse })).status, 403);
    assert.equal((await request('/invites', { method: 'POST', account: sales, data: { name: 'Bad', email: 'bad@example.test', role: 'super_admin' } })).status, 403);
    const result = await request('/work', { method: 'POST', account: sales, data: { module: 'quotes', title: 'Quotation task', status: 'Draft', assignee_id: 'colleague' } });
    assert.equal(result.status, 201); quoteId = result.data.id;
    const own = (await request('/work?module=quotes', { account: sales })).data.items;
    assert.equal(own.length, 1); assert.equal(own[0].assignee_id, sales.user.id);
    assert.equal((await request('/work?module=quotes', { account: colleague })).data.items.length, 0);
    assert.equal((await request('/work/' + quoteId, { method: 'PATCH', account: colleague, data: { title: 'Hijack', status: 'Draft', version: 1 } })).status, 403);
    assert.equal((await request('/work?module=quotes', { account: manager })).data.items.length, 1);
    assert.equal((await request('/work', { method: 'POST', account: management, data: { module: 'quotes', title: 'Read-only bypass', status: 'Draft' } })).status, 403);
    const shipment = await request('/work', { method: 'POST', account: owner, data: { module: 'shipments', title: 'Sales progress visibility', status: 'In transit', assignee_id: sales.user.id } });
    assert.equal(shipment.status, 201);
    assert.equal((await request('/work?module=shipments', { account: sales })).data.items.length, 1);
    assert.equal((await request('/work/' + shipment.data.id, { method: 'PATCH', account: sales, data: { title: 'Cannot alter operations', status: 'Delivered', version: 1 } })).status, 403);
  });
  await t.test('approvals require managers and updates reject stale versions', async () => {
    assert.equal((await request('/work/' + quoteId, { method: 'PATCH', account: sales, data: { title: 'Quotation', status: 'Approved', version: 1 } })).status, 403);
    assert.equal((await request('/work', { method: 'POST', account: accounts, data: { module: 'finance', title: 'Finance', status: 'Recorded' } })).status, 403);
    assert.equal((await request('/work/' + quoteId, { method: 'PATCH', account: manager, data: { title: 'Approved quotation', status: 'Approved', assignee_id: sales.user.id, version: 1 } })).status, 200);
    assert.equal((await request('/work/' + quoteId, { method: 'PATCH', account: manager, data: { title: 'Old update', status: 'Draft', version: 1 } })).status, 409);
    assert.equal((await request('/work/' + quoteId, { method: 'PATCH', account: sales, data: { title: 'Alter approved', status: 'Draft', version: 2 } })).status, 403);
    assert.equal((await request('/work', { method: 'POST', account: manager, data: { module: 'quotes', title: 'Wrong assignee', status: 'Draft', assignee_id: 'warehouse' } })).status, 400);
  });
  await t.test('deactivation revokes existing sessions and blocks future sign-in', async () => {
    assert.equal((await request('/users/' + sales.user.id, { method: 'PATCH', account: owner, data: { role: 'sales', active: false } })).status, 200);
    assert.equal((await request('/me', { account: sales })).status, 401);
    assert.equal((await request('/login', { method: 'POST', data: { email: sales.user.email, password } })).status, 401);
    assert.equal((await request('/users/' + owner.user.id, { method: 'PATCH', account: owner, data: { role: 'sales', active: true } })).status, 409);
  });
  await t.test('reset links require owner authority, expire, and invalidate sessions', async () => {
    assert.equal((await request('/users/colleague/reset', { method: 'POST', account: colleague, data: {} })).status, 403);
    let result = await request('/users/colleague/reset', { method: 'POST', account: owner, data: {} });
    assert.equal(result.status, 201);
    let token = new URL(result.data.link).hash.slice('#reset='.length);
    await store.query('UPDATE staff_resets SET expires_at=0 WHERE token_hash=$1', [digest(token)]);
    assert.equal((await request('/reset-password', { method: 'POST', data: { token, email: 'colleague@example.test', password } })).status, 403);
    result = await request('/users/colleague/reset', { method: 'POST', account: owner, data: {} }); token = new URL(result.data.link).hash.slice('#reset='.length);
    assert.equal((await request('/reset-password', { method: 'POST', data: { token, email: 'colleague@example.test', password: password + 'new' } })).status, 200);
    assert.equal((await request('/me', { account: colleague })).status, 401);
    assert.equal((await request('/reset-password', { method: 'POST', data: { token, email: 'colleague@example.test', password } })).status, 403);
    colleague = await login('colleague@example.test', password + 'new');
  });
  await t.test('password changes and logout revoke cookies; audit contains no secrets', async () => {
    assert.equal((await request('/password', { method: 'POST', account: colleague, data: { currentPassword: password + 'new', password: password + 'changed' } })).status, 200);
    assert.equal((await request('/me', { account: colleague })).status, 401);
    assert.equal((await request('/logout', { method: 'POST', account: manager, data: {} })).status, 200);
    assert.equal((await request('/me', { account: manager })).status, 401);
    const audit = await request('/audit', { account: owner }); assert.equal(audit.status, 200);
    assert.ok(audit.data.events.some(x => x.action === 'user.access_changed'));
    assert.equal(JSON.stringify(audit.data).includes(password), false);
    assert.equal(JSON.stringify((await request('/users', { account: owner })).data).includes('password_hash'), false);
  });
  await t.test('expiry and throttling are enforced by server', async () => {
    await store.query('UPDATE staff_sessions SET expires_at=0 WHERE user_id=$1', ['accounts']);
    assert.equal((await request('/me', { account: accounts })).status, 401);
    for (let i = 0; i < 8; i++) assert.equal((await request('/login', { method: 'POST', data: { email: 'unknown@example.test', password: 'short' } })).status, 401);
    assert.equal((await request('/login', { method: 'POST', data: { email: 'unknown@example.test', password: 'short' } })).status, 429);
  });
});

test('missing database cannot accept accounts or passwords', async t => {
  const server = http.createServer(await createHandler({ store: null, origin: 'https://staff.example.test' }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(origin + '/api/status')).json(), { ready: false, setupAvailable: false });
  assert.equal((await fetch(origin + '/api/login', { method: 'POST' })).status, 503);
  assert.equal((await (await fetch(origin + '/api/access-model')).json()).roles.length, 13);
  const response = await fetch(origin + '/'); assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});
