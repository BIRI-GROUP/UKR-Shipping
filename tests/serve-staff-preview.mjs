// Disposable local browser-test fixture. Never used by the deployed service.
import http from 'node:http';
import { createHandler, hashPassword } from '../services/staff/server.mjs';
import { testStore } from '../services/staff/store.mjs';
import { addApprovedChinaRoutes } from '../services/staff/route-seed.mjs';
process.env.NODE_ENV = 'test';
const store = await testStore();
await addApprovedChinaRoutes(store);
const hash = await hashPassword('Local-test-only-482!');
for (const [id, name, role] of [['test-owner', 'Test Owner', 'super_admin'], ['test-warehouse', 'Test Warehouse', 'china_warehouse']]) {
  await store.query('INSERT INTO staff_users (id,email,name,role,password_hash,active,created_at) VALUES ($1,$2,$3,$4,$5,1,$6)', [id, id + '@example.test', name, role, hash, Date.now()]);
}
const handler = await createHandler({ store, origin: 'http://127.0.0.1:4180', publicOrigin: 'http://127.0.0.1:4173', secure: false });
http.createServer(handler).listen(4180, '127.0.0.1', () => console.log('Disposable staff browser fixture: http://127.0.0.1:4180'));
