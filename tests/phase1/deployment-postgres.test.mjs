import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, migrate, requireSchema } from '../../services/staff/phase1/db.mjs';
import { inspectDatabase } from '../../services/staff/phase1/deployment-check.mjs';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes('test')) throw Error('Disposable TEST_DATABASE_URL required');
await test('deployment checks against a disposable PostgreSQL schema', async t => {
  const schema = 'preflight_' + randomUUID().replaceAll('-', '');
  const admin = await openDatabase(url); let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = await openDatabase(url, { options: '-c search_path=' + schema + ',public' });
    await migrate(db);
    await t.test('all real migration checksums pass after explicit migration', async () => { await requireSchema(db); });
    await t.test('a missing intake migration is a blocker, even if Phase 1 is applied', async () => {
      await assert.rejects(db.tx(async q => {
        await q.query("DELETE FROM ukr_schema_migrations WHERE name='0005_booking_intake.sql'");
        await assert.rejects(requireSchema(q), /Required migration is not applied/);
        throw Error('rollback-test');
      }), /rollback-test/);
      await requireSchema(db);
    });
    await t.test('checksum drift blocks startup without altering data', async () => {
      await assert.rejects(db.tx(async q => {
        await q.query("UPDATE ukr_schema_migrations SET checksum=$1 WHERE name='0004_foundation_invariants.sql'", ['0'.repeat(64)]);
        await assert.rejects(requireSchema(q), /checksum changed/); throw Error('rollback-test');
      }), /rollback-test/);
      await requireSchema(db);
    });
    await t.test('read-only inspection accurately reports unconfigured backups', async () => {
      const before = await db.query('SELECT count(*)::int AS count FROM backup_runs');
      const reader = await openDatabase(url, { options: '-c search_path=' + schema + ',public -c default_transaction_read_only=on' });
      let result;
      try { result = await inspectDatabase(reader); } finally { await reader.close(); }
      assert.equal(result.find(c => c.id === 'schema').status, 'pass');
      assert.equal(result.find(c => c.id === 'backup_policy').status, 'blocked');
      assert.equal(result.find(c => c.id === 'recent_backup').status, 'blocked');
      assert.deepEqual((await db.query('SELECT count(*)::int AS count FROM backup_runs')).rows, before.rows);
    });
  } finally { await db?.close(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.close(); }
});
