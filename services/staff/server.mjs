import http from 'node:http';
import { randomBytes, randomUUID, createHash, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { roles, modules, can, accessDescription } from './policy.mjs';
import { postgresStore } from './store.mjs';
const scrypt = promisify(scryptCallback);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const email = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function passwordValid(value) { return typeof value === 'string' && value.length >= 12 && value.length <= 128; }
export async function hashPassword(password) {
  if (!passwordValid(password)) fail(400, 'Use a password between 12 and 128 characters.');
  const salt = randomBytes(16).toString('hex');
  return `s1:${salt}:${Buffer.from(await scrypt(password, salt, 64, scryptOptions)).toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (!passwordValid(password) || typeof encoded !== 'string') return false;
  const [version, salt, expected] = encoded.split(':');
  if (version !== 's1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const actual = Buffer.from(await scrypt(password, salt, 64, scryptOptions)).toString('hex');
  return same(actual, expected);
}
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: !!u.active, roleName: roles[u.role]?.name || 'Unknown' });
async function audit(db, actor, action, target, detail = '') {
  await db.query('INSERT INTO staff_audit (id,actor_id,action,target,detail,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), actor, action, target, detail, Date.now()]);
}
async function consumeLimit(store, key, limit, minutes = 15) {
  return store.tx(async db => {
    const now = Date.now();
    await db.query('DELETE FROM staff_limits WHERE window_end < $1', [now]);
    const old = (await db.query('SELECT * FROM staff_limits WHERE key=$1', [key])).rows[0];
    if (old && old.hits >= limit) return false;
    if (old) await db.query('UPDATE staff_limits SET hits=hits+1 WHERE key=$1', [key]);
    else await db.query('INSERT INTO staff_limits (key,hits,window_end) VALUES ($1,1,$2)', [key, now + minutes * 60000]);
    return true;
  });
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Send JSON.');
  let value = ''; for await (const chunk of req) { value += chunk; if (Buffer.byteLength(value) > 32768) fail(413, 'Request too large.'); }
  try { const parsed = JSON.parse(value); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(); return parsed; } catch { fail(400, 'Invalid request.'); }
}
const files = {
  '/': ['../../apps/staff/index.html', 'text/html; charset=utf-8'],
  '/staff.js': ['../../apps/staff/staff.js', 'text/javascript; charset=utf-8'],
  '/staff.css': ['../../apps/staff/staff.css', 'text/css; charset=utf-8'],
  '/logo.svg': ['../../site/assets/ukr-shipping-blue.svg', 'image/svg+xml']
};
export async function createHandler({ store, origin, ownerEmail = '', setupTokenHash = '', setupExpires = 0, secure = true }) {
  if (!secure && process.env.NODE_ENV !== 'test') throw new Error('Insecure cookies permitted only in local tests');
  const cookieName = secure ? '__Host-ukr_staff' : 'ukr_staff_test';
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const dummy = await hashPassword(token());
  async function session(req, mutation) {
    const found = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='));
    const raw = found?.slice(cookieName.length + 1) || '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) fail(401, 'Please sign in.');
    const result = await store.query('SELECT u.*,s.csrf,s.token_hash,s.expires_at FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.active=1', [digest(raw), Date.now()]);
    const user = result.rows[0]; if (!user || !roles[user.role]) fail(401, 'Please sign in.');
    if (mutation && !same(req.headers['x-csrf-token'], user.csrf)) fail(403, 'Session validation failed. Refresh and try again.');
    return user;
  }
  async function freshUser(db, prior, permission) {
    const current = (await db.query('SELECT u.* FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.active=1', [prior.token_hash, Date.now()])).rows[0];
    if (!current || !roles[current.role]) fail(401, 'Please sign in.');
    if (permission && !can(current, permission)) fail(403, 'Access denied.');
    return current;
  }
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, origin); const route = url.pathname; const method = req.method;
      if (route === '/healthz' && method === 'GET') return json({ status: store ? 'ready' : 'database_required' });
      if (route === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /\n'); }
      if (files[route] && method === 'GET') { const [file, type] = files[route]; res.writeHead(200, { 'Content-Type': type }); return res.end(await readFile(new URL(file, import.meta.url))); }
      if (route === '/api/status' && method === 'GET') return json({ ready: !!store, setupAvailable: !!store && Date.now() < setupExpires && Number((await store.query('SELECT COUNT(*) AS count FROM staff_users')).rows[0].count) === 0 });
      if (route === '/api/access-model' && method === 'GET') return json({ roles: Object.entries(roles).map(([id, r]) => ({ id, name: r.name, purpose: r.purpose, modules: accessDescription(id) })) });
      if (!route.startsWith('/api/')) fail(404, 'Not found.');
      if (!store) fail(503, 'Staff sign-in is awaiting its dedicated database. No accounts or passwords can be saved yet.');
      const mutation = !['GET', 'HEAD'].includes(method);
      if (mutation && req.headers.origin !== origin) fail(403, 'Untrusted request origin.');
      let data = mutation ? await body(req) : {};
      if (['/api/login', '/api/setup', '/api/accept-invite', '/api/reset-password'].includes(route) && method === 'POST') {
        if (!await consumeLimit(store, 'auth-global', 100)) fail(429, 'Too many attempts. Try again in 15 minutes.');
        if (!await consumeLimit(store, 'auth:' + digest(email(data.email)), 8)) fail(429, 'Too many attempts. Try again in 15 minutes.');
      }
      if (route === '/api/setup' && method === 'POST') {
        if (Date.now() >= setupExpires || !setupTokenHash || !same(digest(String(data.token || '')), setupTokenHash) || email(data.email) !== email(ownerEmail)) fail(403, 'Setup link or owner email is invalid or expired.');
        const name = clean(data.name, 100); if (!name) fail(400, 'Enter your name.');
        const hash = await hashPassword(data.password);
        await store.tx(async db => {
          if (Number((await db.query('SELECT COUNT(*) AS count FROM staff_users')).rows[0].count)) fail(409, 'Owner setup is already complete.');
          const id = randomUUID();
          await db.query('INSERT INTO staff_users (id,email,name,role,password_hash,active,created_at) VALUES ($1,$2,$3,$4,$5,1,$6)', [id, email(ownerEmail), name, 'super_admin', hash, Date.now()]);
          await audit(db, id, 'owner.created', id);
        }); return json({ message: 'Owner account created. Sign in with your new password.' }, 201);
      }
      if (route === '/api/accept-invite' && method === 'POST') {
        const invitationHash = digest(String(data.token || ''));
        const hash = await hashPassword(data.password);
        await store.tx(async db => {
          const invitation = (await db.query('SELECT * FROM staff_invites WHERE token_hash=$1 AND used=0 AND expires_at>$2', [invitationHash, Date.now()])).rows[0];
          if (!invitation || invitation.email !== email(data.email)) fail(403, 'Invitation is invalid or expired.');
          const issuer = (await db.query('SELECT * FROM staff_users WHERE id=$1', [invitation.created_by])).rows[0];
          if (!can(issuer, 'users')) fail(403, 'This invitation is no longer active.');
          if ((await db.query('SELECT id FROM staff_users WHERE email=$1', [invitation.email])).rows.length) fail(409, 'An account already exists.');
          const id = randomUUID();
          await db.query('INSERT INTO staff_users (id,email,name,role,password_hash,active,created_at) VALUES ($1,$2,$3,$4,$5,1,$6)', [id, invitation.email, invitation.name, invitation.role, hash, Date.now()]);
          await db.query('UPDATE staff_invites SET used=1 WHERE token_hash=$1', [invitationHash]); await audit(db, id, 'invite.accepted', id, invitation.role);
        }); return json({ message: 'Account activated. You can now sign in.' }, 201);
      }
      if (route === '/api/login' && method === 'POST') {
        const candidate = (await store.query('SELECT * FROM staff_users WHERE email=$1', [email(data.email)])).rows[0];
        const valid = await verifyPassword(data.password, candidate?.password_hash || dummy);
        if (!valid || !candidate?.active || !roles[candidate.role]) fail(401, 'Email or password is incorrect.');
        const raw = token(), csrf = token(), expires = Date.now() + 8 * 3600000;
        await store.tx(async db => {
          const current = (await db.query('SELECT * FROM staff_users WHERE id=$1', [candidate.id])).rows[0];
          if (!current?.active || current.password_hash !== candidate.password_hash) fail(401, 'Email or password is incorrect.');
          await db.query('DELETE FROM staff_sessions WHERE expires_at<$1', [Date.now()]);
          await db.query('INSERT INTO staff_sessions (token_hash,user_id,csrf,expires_at) VALUES ($1,$2,$3,$4)', [digest(raw), candidate.id, csrf, expires]);
          await audit(db, candidate.id, 'session.login', candidate.id);
        }); res.setHeader('Set-Cookie', cookie(raw, 28800)); return json({ user: publicUser(candidate), csrf });
      }
      if (route === '/api/reset-password' && method === 'POST') {
        const resetHash = digest(String(data.token || ''));
        const hash = await hashPassword(data.password);
        await store.tx(async db => {
          const reset = (await db.query('SELECT * FROM staff_resets WHERE token_hash=$1 AND used=0 AND expires_at>$2', [resetHash, Date.now()])).rows[0];
          if (!reset) fail(403, 'Password reset link is invalid or expired.');
          const target = (await db.query('SELECT * FROM staff_users WHERE id=$1', [reset.user_id])).rows[0];
          const issuer = (await db.query('SELECT * FROM staff_users WHERE id=$1', [reset.created_by])).rows[0];
          if (!target?.active || target.email !== email(data.email) || !can(issuer, 'users')) fail(403, 'Password reset link is invalid or expired.');
          await db.query('UPDATE staff_users SET password_hash=$1 WHERE id=$2', [hash, target.id]);
          await db.query('UPDATE staff_resets SET used=1 WHERE user_id=$1', [target.id]);
          await db.query('DELETE FROM staff_sessions WHERE user_id=$1', [target.id]);
          await audit(db, target.id, 'password.reset', target.id);
        }); return json({ message: 'Password reset. All previous sessions ended. Sign in with your new password.' });
      }
      const user = await session(req, mutation);
      if (route === '/api/me' && method === 'GET') return json({ user: publicUser(user), csrf: user.csrf, modules: accessDescription(user.role), canManageUsers: can(user, 'users'), canReadAudit: can(user, 'audit') });
      if (route === '/api/logout' && method === 'POST') {
        await store.tx(async db => { await db.query('DELETE FROM staff_sessions WHERE token_hash=$1', [user.token_hash]); await audit(db, user.id, 'session.logout', user.id); });
        res.setHeader('Set-Cookie', cookie('', 0)); return json({ ok: true });
      }
      if (route === '/api/password' && method === 'POST') {
        if (!await consumeLimit(store, 'password:' + user.id, 5)) fail(429, 'Too many attempts. Try later.');
        if (!await verifyPassword(data.currentPassword, user.password_hash)) fail(403, 'Current password is incorrect.');
        const hash = await hashPassword(data.password);
        await store.tx(async db => {
          const current = await freshUser(db, user);
          if (current.password_hash !== user.password_hash) fail(401, 'Please sign in.');
          await db.query('UPDATE staff_users SET password_hash=$1 WHERE id=$2', [hash, user.id]);
          await db.query('DELETE FROM staff_sessions WHERE user_id=$1', [user.id]);
          await db.query('UPDATE staff_resets SET used=1 WHERE user_id=$1', [user.id]);
          await audit(db, user.id, 'password.changed', user.id);
        });
        res.setHeader('Set-Cookie', cookie('', 0)); return json({ message: 'Password changed. Sign in again.' });
      }
      if (route === '/api/roles' && method === 'GET') {
        if (!can(user, 'users') && !can(user, 'audit')) fail(403, 'Access denied.');
        return json({ roles: Object.entries(roles).map(([id, r]) => ({ id, name: r.name, purpose: r.purpose, modules: accessDescription(id) })) });
      }
      if (route === '/api/users' && method === 'GET') {
        if (!can(user, 'users')) fail(403, 'Access denied.');
        return json({ users: (await store.query('SELECT * FROM staff_users ORDER BY created_at')).rows.map(publicUser) });
      }
      if (route === '/api/invites' && method === 'POST') {
        if (!can(user, 'users')) fail(403, 'Access denied.');
        const address = email(data.email), name = clean(data.name, 100), role = data.role;
        if (!validEmail(address) || !name || !roles[role]) fail(400, 'Enter a name, valid email and role.');
        const raw = token();
        await store.tx(async db => {
          await freshUser(db, user, 'users');
          if ((await db.query('SELECT id FROM staff_users WHERE email=$1', [address])).rows.length) fail(409, 'This email already has an account.');
          await db.query('UPDATE staff_invites SET used=1 WHERE email=$1', [address]);
          await db.query('INSERT INTO staff_invites (token_hash,email,name,role,created_by,expires_at,used) VALUES ($1,$2,$3,$4,$5,$6,0)', [digest(raw), address, name, role, user.id, Date.now() + 48 * 3600000]);
          await audit(db, user.id, 'invite.created', address, role);
        }); return json({ link: `${origin}/#invite=${raw}`, message: 'Private activation link; valid for 48 hours. Share it directly with this employee. No email was sent.' }, 201);
      }
      const userMatch = route.match(/^\/api\/users\/([\w-]+)$/);
      const resetMatch = route.match(/^\/api\/users\/([\w-]+)\/reset$/);
      if (resetMatch && method === 'POST') {
        const raw = token();
        await store.tx(async db => {
          await freshUser(db, user, 'users');
          const target = (await db.query('SELECT * FROM staff_users WHERE id=$1 AND active=1', [resetMatch[1]])).rows[0];
          if (!target) fail(404, 'Active staff account not found.');
          await db.query('UPDATE staff_resets SET used=1 WHERE user_id=$1', [target.id]);
          await db.query('INSERT INTO staff_resets (token_hash,user_id,created_by,expires_at,used) VALUES ($1,$2,$3,$4,0)', [digest(raw), target.id, user.id, Date.now() + 30 * 60000]);
          await audit(db, user.id, 'password.reset_requested', target.id);
        }); return json({ link: `${origin}/#reset=${raw}`, message: 'Private password reset link; valid for 30 minutes. Share directly with this employee. No email was sent.' }, 201);
      }
      if (userMatch && method === 'PATCH') {
        if (!can(user, 'users')) fail(403, 'Access denied.');
        if (!roles[data.role] || typeof data.active !== 'boolean') fail(400, 'Choose a valid role and account status.');
        await store.tx(async db => {
          await freshUser(db, user, 'users');
          const target = (await db.query('SELECT * FROM staff_users WHERE id=$1', [userMatch[1]])).rows[0]; if (!target) fail(404, 'User not found.');
          if (target.role === 'super_admin' && target.active && (data.role !== 'super_admin' || !data.active)) {
            if (Number((await db.query("SELECT COUNT(*) AS count FROM staff_users WHERE role='super_admin' AND active=1")).rows[0].count) <= 1) fail(409, 'Keep at least one active Super Admin.');
          }
          await db.query('UPDATE staff_users SET role=$1,active=$2 WHERE id=$3', [data.role, data.active ? 1 : 0, target.id]);
          await db.query('DELETE FROM staff_sessions WHERE user_id=$1', [target.id]);
          await db.query('UPDATE staff_invites SET used=1 WHERE created_by=$1', [target.id]);
          await db.query('UPDATE staff_resets SET used=1 WHERE user_id=$1 OR created_by=$1', [target.id]);
          await audit(db, user.id, 'user.access_changed', target.id, `${data.role}; active=${data.active}`);
        }); return json({ ok: true });
      }
      if (route === '/api/audit' && method === 'GET') {
        if (!can(user, 'audit')) fail(403, 'Access denied.');
        return json({ events: (await store.query('SELECT a.*,u.name AS actor_name FROM staff_audit a LEFT JOIN staff_users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100')).rows });
      }
      if (route === '/api/work' && method === 'GET') {
        const module = url.searchParams.get('module'); const grant = roles[user.role].grants[module];
        if (!grant) fail(403, 'Access denied.');
        const query = grant.read === 'all' ? 'SELECT * FROM staff_work WHERE module=$1 ORDER BY updated_at DESC LIMIT 200' : 'SELECT * FROM staff_work WHERE module=$1 AND assignee_id=$2 ORDER BY updated_at DESC LIMIT 200';
        return json({ items: (await store.query(query, grant.read === 'all' ? [module] : [module, user.id])).rows });
      }
      if (route === '/api/assignees' && method === 'GET') {
        const module = url.searchParams.get('module');
        if (roles[user.role].grants[module]?.write !== 'all') return json({ users: [{ id: user.id, name: user.name }] });
        return json({ users: (await store.query('SELECT * FROM staff_users WHERE active=1')).rows.filter(u => !!roles[u.role]?.grants[module]?.read).map(u => ({ id: u.id, name: u.name })) });
      }
      const workMatch = route.match(/^\/api\/work\/([\w-]+)$/);
      if ((route === '/api/work' && method === 'POST') || (workMatch && method === 'PATCH')) {
        const result = await store.tx(async db => {
          // Read current permissions inside the write transaction so revocation cannot race a write.
          const current = await freshUser(db, user);
          const old = workMatch ? (await db.query('SELECT * FROM staff_work WHERE id=$1', [workMatch[1]])).rows[0] : null;
          if (workMatch && !old) fail(404, 'Work item not found.');
          const module = old?.module || data.module;
          if (!modules[module] || !can(current, old ? 'write' : 'create', module, old)) fail(403, 'Access denied.');
          if (old && Number(data.version) !== old.version) fail(409, 'This item changed. Refresh before saving.');
          const title = clean(data.title, 160), reference = clean(data.reference, 100), note = clean(data.note, 3000), status = data.status;
          if (!title || !modules[module].states.includes(status)) fail(400, 'Enter a title and valid status.');
          if (status === 'Approved' && old?.status !== 'Approved' && !can(current, 'approve', module)) fail(403, 'Only a manager can approve this work.');
          if (['quotes', 'finance'].includes(module) && ['Approved', 'Sent', 'Accepted', 'Recorded', 'Reconciled'].includes(old?.status) && !can(current, 'approve', module)) fail(403, 'Approved work must be changed by a manager.');
          if (['quotes', 'finance'].includes(module) && ['Sent', 'Accepted', 'Recorded', 'Reconciled'].includes(status) && !can(current, 'approve', module)) fail(403, 'A manager must record this stage.');
          const assignee = roles[current.role].grants[module].write === 'all' ? String(data.assignee_id || current.id) : current.id;
          const target = (await db.query('SELECT * FROM staff_users WHERE id=$1 AND active=1', [assignee])).rows[0];
          if (!target || !roles[target.role]?.grants[module]?.read) fail(400, 'Choose an active employee with access to this queue.');
          const id = old?.id || randomUUID(), now = Date.now();
          if (old) await db.query('UPDATE staff_work SET title=$1,reference=$2,status=$3,note=$4,assignee_id=$5,version=version+1,updated_at=$6 WHERE id=$7', [title, reference, status, note, assignee, now, id]);
          else await db.query('INSERT INTO staff_work (id,module,title,reference,status,note,assignee_id,created_by,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$9)', [id, module, title, reference, status, note, assignee, current.id, now]);
          await audit(db, current.id, old ? 'work.updated' : 'work.created', id, `${module}; ${old?.status || 'new'} → ${status}`);
          return { id };
        }); return json(result, workMatch ? 200 : 201);
      }
      fail(404, 'Not found.');
    } catch (error) {
      if (res.headersSent) return res.end();
      if (!error.status) console.error('staff_request_failed', error.code || error.name);
      json({ error: error.status ? error.message : 'Service unavailable. Please try again.' }, error.status || 503);
    }
  };
}
async function start() {
  const origin = process.env.APP_ORIGIN || 'https://ukr-staff-staging.onrender.com';
  let store = null;
  if (process.env.DATABASE_URL) store = await postgresStore(process.env.DATABASE_URL);
  const handler = await createHandler({ store, origin, ownerEmail: process.env.OWNER_EMAIL, setupTokenHash: process.env.SETUP_TOKEN_HASH, setupExpires: Number(process.env.SETUP_EXPIRES_AT || 0) });
  const server = http.createServer(handler); server.requestTimeout = 15000; server.headersTimeout = 10000;
  server.listen(Number(process.env.PORT || 10000), '0.0.0.0', () => console.log('UKR staff service ready; database=' + !!store));
  process.on('SIGTERM', () => server.close(async () => { await store?.close(); process.exit(0); }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start().catch(e => { console.error('Staff startup failed', e.code || e.name); process.exit(1); });
