import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Same pg driver and transaction contract used by services/staff/store.mjs.
// No SQLite, JSON file or memory fallback in the portal runtime.
export async function openDatabase(connectionString,options={}) {
  if(!connectionString)throw Error('PostgreSQL connection is required');
  const {Pool}=await import('pg');
  const pool=new Pool({connectionString,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,
    statement_timeout:15000,...options});
  const db={query:(sql,values=[])=>pool.query(sql,values),close:()=>pool.end(),dialect:'postgres'};
  db.tx=async fn=>{const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(91276831)');const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}};
  return db;
}
export async function migrate(db,{directory=new URL('../migrations/',import.meta.url),legacy=true}={}) {
  if(legacy){
    for(const [version,path] of [['0000a_staff',new URL('../schema.sql',import.meta.url)],['0000b_booking_lab',new URL('../../booking-lab/schema.sql',import.meta.url)]] ){
      await apply(db,version,await readFile(path,'utf8'));
    }
  }
  const files=(await readdir(directory)).filter(f=>/^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  for(const name of files)await apply(db,name,await readFile(new URL(name,directory),'utf8'));
  return files;
}
async function apply(db,name,sql){const checksum=createHash('sha256').update(sql).digest('hex');await db.tx(async q=>{
  await q.query(`CREATE TABLE IF NOT EXISTS ukr_schema_migrations(id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name TEXT NOT NULL UNIQUE,checksum CHAR(64) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_by UUID)`);
  const old=(await q.query('SELECT checksum FROM ukr_schema_migrations WHERE name=$1',[name])).rows[0];
  if(old){if(old.checksum!==checksum)throw Error('Applied migration checksum changed: '+name);return;}
  await q.query(sql);await q.query('INSERT INTO ukr_schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
});}
export async function requireSchema(db){const result=await db.query("SELECT name FROM ukr_schema_migrations WHERE name='0004_foundation_invariants.sql'");if(!result.rows.length)throw Error('Phase 1 migrations must be explicitly applied before startup');}
async function main(){if(!process.argv.includes('--apply'))throw Error('Use --apply only against an approved database');const db=await openDatabase(process.env.DATABASE_URL);try{const files=await migrate(db);console.log('Applied/verified '+files.length+' numbered migrations; no mail or deployment performed.');}finally{await db.close();}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error('Migration failed:',e.code||e.message);process.exitCode=1;});
