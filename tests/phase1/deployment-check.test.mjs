import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { configuredPaths, inspectConfig, hasPersistentMount, inspectStorage } from '../../services/staff/phase1/deployment-check.mjs';
import { requireSchema } from '../../services/staff/phase1/db.mjs';

const env = {
  NODE_ENV: 'production', AUTH_TEST_MODE: 'false', APP_ORIGIN: 'https://portal.example.test',
  DATABASE_URL: 'postgresql://test:example-only@database.example.test/ukr',
  PORTAL_FILES_PATH: '/var/data/ukr/files', PORTAL_BACKUP_PATH: '/var/data/ukr/backups',
  PORTAL_ENCRYPTION_KEY: 'ab'.repeat(32), PORTAL_BACKUP_KEY: 'cd'.repeat(32),
  PORTAL_SCHEDULER_ENABLED: 'true'
};
const mount = '100 20 8:2 / /var/data/ukr rw,relatime - ext4 /dev/example rw';
const config = (changes = {}, version = '24.1.0') => inspectConfig({ ...env, ...changes }, version);
const status = (changes, id) => config(changes).find(c => c.id === id).status;
const fsOK = {
  readFile: async () => mount, realpath: async p => p,
  stat: async () => ({ isDirectory: () => true }), access: async () => {}
};
test('valid production configuration contains only redacted checks', () => {
  const report = config(); assert.ok(report.every(c => c.status === 'pass'));
  for (const value of [env.DATABASE_URL, env.PORTAL_ENCRYPTION_KEY, env.PORTAL_BACKUP_KEY]) assert.ok(!JSON.stringify(report).includes(value));
});
test('requires tested Node 24', () => assert.equal(config({}, '22.16.0')[0].status, 'blocked'));
test('refuses fixed-code mode and nonproduction mode for deployment', () => {
  assert.equal(status({ AUTH_TEST_MODE: 'true' }, 'test_auth_disabled'), 'blocked');
  assert.equal(status({ AUTH_TEST_MODE: 'TRUE' }, 'test_auth_disabled'), 'blocked');
  assert.equal(status({ NODE_ENV: 'development' }, 'production_mode'), 'blocked');
});
test('validates exact HTTPS origins and PostgreSQL URLs', () => {
  for (const value of ['http://portal.example.test', 'https://portal.example.test/path', 'https://u:p@portal.example.test']) assert.equal(status({ APP_ORIGIN: value }, 'https_origin'), 'blocked');
  for (const value of ['', 'file:///db', 'postgresql://db/']) assert.equal(status({ DATABASE_URL: value }, 'database_connection'), 'blocked');
});
test('requires independent non-placeholder encryption keys', () => {
  assert.equal(status({ PORTAL_ENCRYPTION_KEY: '0'.repeat(64) }, 'portal_key'), 'blocked');
  assert.equal(status({ PORTAL_BACKUP_KEY: env.PORTAL_ENCRYPTION_KEY.toUpperCase() }, 'backup_key'), 'blocked');
  assert.equal(status({ PORTAL_BACKUP_KEY: '' }, 'backup_key'), 'blocked');
});
test('rejects overlapping, relative and traversing storage locations', () => {
  for (const p of ['files', '/tmp/files', '/var/data/ukr', '/var/data/ukr-other/files', '/var/data/ukr/../files', '/var/data/ukr/files/']) assert.equal(configuredPaths({ ...env, PORTAL_FILES_PATH: p }), null);
  assert.equal(configuredPaths({ ...env, PORTAL_BACKUP_PATH: env.PORTAL_FILES_PATH }), null);
  assert.equal(configuredPaths({ ...env, PORTAL_BACKUP_PATH: env.PORTAL_FILES_PATH + '/backups' }), null);
});
test('folder creation alone cannot pass persistent-disk verification', () => {
  assert.equal(hasPersistentMount('20 1 0:1 / / rw - overlay overlay rw'), false);
  assert.equal(hasPersistentMount(mount.replace('/var/data/ukr', '/var/data/ukr-other')), false);
  assert.equal(hasPersistentMount(mount), true);
});
test('rejects read-only and memory-backed mounts', () => {
  assert.equal(hasPersistentMount(mount.replace('rw,relatime', 'ro,relatime')), false);
  for (const t of ['tmpfs', 'ramfs', 'overlay']) assert.equal(hasPersistentMount(mount.replace('ext4', t)), false);
});
test('runtime disk check performs no filesystem writes', async () => assert.equal((await inspectStorage(env, fsOK)).status, 'pass'));
test('checks an existing ancestor for paths not created yet', async () => {
  const fs = { ...fsOK, realpath: async p => { if (p !== '/var/data/ukr') throw Object.assign(Error(), { code: 'ENOENT' }); return p; } };
  assert.equal((await inspectStorage(env, fs)).status, 'pass');
});
test('rejects symlinked paths and non-directory ancestors', async () => {
  assert.equal((await inspectStorage(env, { ...fsOK, realpath: async () => '/tmp/escape' })).status, 'blocked');
  assert.equal((await inspectStorage(env, { ...fsOK, stat: async () => ({ isDirectory: () => false }) })).status, 'blocked');
});
test('permission and mount errors fail closed without disclosing paths or secrets', async () => {
  const result = await inspectStorage(env, { ...fsOK, access: async () => { throw Error(env.DATABASE_URL); } });
  assert.equal(result.status, 'blocked'); assert.ok(!JSON.stringify(result).includes(env.DATABASE_URL));
});
test('schema verification requires every shipped migration with matching checksums', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ukr-schema-check-'));
  try {
    await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;');
    await writeFile(join(directory, '0005_intake.sql'), 'SELECT 5;');
    const options = { legacy: false, directory: pathToFileURL(directory + '/') };
    const hash = text => createHash('sha256').update(text).digest('hex');
    const rows = [{ name: '0001_first.sql', checksum: hash('SELECT 1;') }, { name: '0005_intake.sql', checksum: hash('SELECT 5;') }];
    const db = data => ({ query: async sql => { assert.equal(sql, 'SELECT name,checksum FROM ukr_schema_migrations'); return { rows: data }; } });
    await requireSchema(db(rows), options);
    await assert.rejects(requireSchema(db(rows.slice(0, 1)), options), /Required migration is not applied/);
    await assert.rejects(requireSchema(db([rows[0], { ...rows[1], checksum: '0'.repeat(64) }]), options), /checksum changed/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('production storage guard is before database initialization and listener startup', async () => {
  const code = await readFile(new URL('../../services/staff/phase1/start.mjs', import.meta.url), 'utf8');
  assert.ok(code.indexOf("if(config.mode==='production'") < code.indexOf('const db=await openDatabase'));
  assert.ok(code.indexOf('await requireSchema(db)') < code.indexOf('server.listen'));
  assert.ok(code.includes('await db.close();throw error;'));
});
