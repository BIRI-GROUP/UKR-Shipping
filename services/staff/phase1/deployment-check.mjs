/** Read-only deployment checks. Never creates resources, migrates SQL, or sends mail. */
import { readFile, realpath, access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, requireSchema } from './db.mjs';
import { readConfig } from './core.mjs';

export const diskRoot = '/var/data/ukr';
const within = (child, parent) => child.startsWith(parent + sep);
const secretKey = value => /^[a-fA-F0-9]{64}$/.test(value || '') && !/^([0-9a-f])\1+$/i.test(value);
const check = (id, passed, instruction) => ({ id, status: passed ? 'pass' : 'blocked', instruction });

export function configuredPaths(env) {
  const files = env.PORTAL_FILES_PATH;
  const backups = env.PORTAL_BACKUP_PATH;
  if (![files, backups].every(p => typeof p === 'string' && p.startsWith('/') && resolve(p) === p && within(p, diskRoot))) return null;
  if (files === backups || within(files, backups) || within(backups, files)) return null;
  return { files, backups };
}

export function inspectConfig(env, nodeVersion = process.versions.node) {
  let database = false, origin = false;
  try { const u = new URL(env.DATABASE_URL); database = ['postgres:', 'postgresql:'].includes(u.protocol) && !!u.hostname && u.pathname.length > 1; } catch {}
  try { const u = new URL(env.APP_ORIGIN); origin = u.protocol === 'https:' && u.origin === env.APP_ORIGIN && !u.username && !u.password; } catch {}
  return [
    check('node_24', /^24\./.test(nodeVersion), 'Use the tested Node 24 runtime.'),
    check('production_mode', env.NODE_ENV === 'production', 'Use NODE_ENV=production on the operational service.'),
    check('test_auth_disabled', !env.AUTH_TEST_MODE || env.AUTH_TEST_MODE === 'false', 'Remove AUTH_TEST_MODE or set it to false; never activate fixed test codes.'),
    check('https_origin', origin, 'Configure APP_ORIGIN for the exact HTTPS portal address.'),
    check('database_connection', database, 'Retain the dedicated UKR PostgreSQL connection in Render secrets.'),
    check('portal_key', secretKey(env.PORTAL_ENCRYPTION_KEY), 'Configure a persistent private portal encryption key; never rotate an existing key casually.'),
    check('private_paths', !!configuredPaths(env), 'Use separate files and backups directories below /var/data/ukr.'),
    check('backup_key', secretKey(env.PORTAL_BACKUP_KEY) && env.PORTAL_BACKUP_KEY?.toLowerCase() !== env.PORTAL_ENCRYPTION_KEY?.toLowerCase(), 'Configure an independent private backup encryption key.'),
    check('scheduler_enabled', env.PORTAL_SCHEDULER_ENABLED === 'true', 'Enable the scheduler only after backup and workflow checks pass.')
  ];
}

export function hasPersistentMount(mountInfo) {
  return String(mountInfo).split('\n').some(line => {
    const [left, right] = line.split(' - ');
    if (!right) return false;
    const fields = left.split(' ');
    const mount = (fields[4] || '').replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
    const type = right.split(' ')[0];
    return mount === diskRoot && (fields[5] || '').split(',').includes('rw') && !['tmpfs', 'ramfs', 'overlay'].includes(type);
  });
}

/** Disk must be an actual runtime mount, not merely a directory on ephemeral storage. */
export async function inspectStorage(env, fs = { readFile, realpath, access, stat }) {
  const paths = configuredPaths(env);
  if (!paths) return check('persistent_disk', false, 'Configure non-overlapping private disk paths first.');
  try {
    if (!hasPersistentMount(await fs.readFile('/proc/self/mountinfo', 'utf8'))) throw new Error();
    if (await fs.realpath(diskRoot) !== diskRoot) throw new Error();
    for (const target of [paths.files, paths.backups]) {
      let parent = target;
      while (true) {
        try {
          const actual = await fs.realpath(parent);
          if (actual !== parent || !(await fs.stat(actual)).isDirectory()) throw new Error();
          await fs.access(actual, constants.R_OK | constants.W_OK | constants.X_OK);
          break;
        } catch (error) {
          if (error.code !== 'ENOENT' || parent === diskRoot) throw error;
          parent = dirname(parent);
          if (parent !== diskRoot && !within(parent, diskRoot)) throw new Error();
        }
      }
    }
    return check('persistent_disk', true, 'Runtime mount and private directory ancestors verified; this is not a backup-restore test.');
  } catch {
    return check('persistent_disk', false, 'Attach the approved persistent disk at /var/data/ukr and check private directory permissions.');
  }
}

export async function inspectDatabase(db) {
  const checks = [];
  try { await requireSchema(db); checks.push(check('schema', true, 'All committed migration names and checksums match.')); }
  catch { checks.push(check('schema', false, 'Take a verified backup, then explicitly apply the numbered migrations; resolve any checksum mismatch.')); return checks; }
  try {
    const row = (await db.query("SELECT value FROM settings WHERE key='backup_policy' AND deleted_at IS NULL")).rows[0];
    checks.push(check('backup_policy', row?.value?.enabled === true && row.value.frequency === 'daily', 'Enable the configured daily backup policy only after a restore drill.'));
    const recent = (await db.query("SELECT id FROM backup_runs WHERE status='completed' AND manifest_path IS NOT NULL AND completed_at > now() - interval '26 hours' LIMIT 1")).rows.length > 0;
    checks.push(check('recent_backup', recent, 'Require a recent completed backup and verify restoration separately.'));
  } catch { checks.push(check('backup_state', false, 'Verify backup policy and backup history in the dedicated database.')); }
  return checks;
}

export async function inspectDeployment(env = process.env) {
  const checks = inspectConfig(env);
  checks.push(await inspectStorage(env));
  // Inspect the real configuration implementation, not an unconnected environment toggle.
  let sending = false;
  try { sending = readConfig(env).emailSending === true; } catch {}
  checks.push(check('otp_delivery', sending, 'Connect and test the authorised OTP delivery adapter; this codebase currently holds mail in the outbox.'));
  if (checks.find(c => c.id === 'database_connection').status === 'pass') {
    let db;
    try { db = await openDatabase(env.DATABASE_URL); checks.push(...await inspectDatabase(db)); }
    catch { checks.push(check('database_read', false, 'Verify private connectivity from the Render runtime. No database data was changed.')); }
    finally { await db?.close(); }
  }
  return { ready: checks.every(c => c.status === 'pass'), checks, migrationsApplied: false, emailsSent: 0, resourcesChanged: false,
    limits: 'Checks do not upgrade Render, prove SMTP delivery, certify restore recovery, or validate unfinished shipment workflows.' };
}

async function main() {
  const result = await inspectDeployment();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error('Deployment checks failed. Inspect configuration securely; no secrets are included in this report.'); process.exitCode = 1;
});
