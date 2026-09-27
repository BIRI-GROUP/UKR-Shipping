import { readFile } from 'node:fs/promises';
const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
export async function postgresStore(connectionString) {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
  const store = { query: (sql, params = []) => pool.query(sql, params), close: () => pool.end() };
  store.tx = async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(91276831)'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  await store.tx(client => client.query(schema));
  return store;
}
// In-memory SQLite exists only for automated/local tests. Production never falls back to it.
export async function testStore() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test store requires NODE_ENV=test');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON'); db.exec(schema);
  const store = { async query(sql, params = []) {
    const args = []; const translated = sql.replace(/\$(\d+)/g, (_, i) => { args.push(params[Number(i) - 1]); return '?'; });
    const statement = db.prepare(translated);
    if (/^\s*(SELECT|WITH)/i.test(sql) || /RETURNING/i.test(sql)) { const rows = statement.all(...args); return { rows, rowCount: rows.length }; }
    return { rows: [], rowCount: Number(statement.run(...args).changes) };
  }, close: () => db.close() };
  let pending = Promise.resolve();
  store.tx = fn => { const operation = pending.then(async () => { db.exec('BEGIN'); try { const value = await fn(store); db.exec('COMMIT'); return value; } catch (e) { db.exec('ROLLBACK'); throw e; } }); pending = operation.catch(() => {}); return operation; };
  return store;
}
