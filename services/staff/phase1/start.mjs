import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readConfig,localClock} from './core.mjs';
import {openDatabase,requireSchema} from './db.mjs';
import {createPortalHandler} from './http.mjs';
import {createHandler,hashPassword,verifyPassword} from '../server.mjs';
import {tick} from './jobs.mjs';
import {dailyBackup} from './backups.mjs';
export async function start(env=process.env){
 if(Number(process.versions.node.split('.')[0])!==24)throw Error('UKR requires Node 24');const config=readConfig(env);
 if(config.testMode){const parsed=new URL(env.DATABASE_URL||'');if(!/test|development|dev_/i.test(parsed.pathname))throw Error('Test mode requires an explicitly named test/development database');}
 const db=await openDatabase(env.DATABASE_URL);await requireSchema(db);
 const handler=await createPortalHandler({store:db,config,passwords:{hashPassword,verifyPassword},legacyFactory:createHandler});
 const server=http.createServer(handler);server.requestTimeout=15000;server.headersTimeout=10000;server.maxRequestsPerSocket=1000;
 let timer=null,running=false;
 if(env.PORTAL_SCHEDULER_ENABLED==='true')timer=setInterval(async()=>{if(running)return;running=true;try{await db.tx(q=>tick(q,config));const policy=(await db.query("SELECT value FROM settings WHERE key='backup_policy'")).rows[0]?.value;if(policy?.enabled&&localClock(Date.now(),policy.timezone).time>=policy.at)await dailyBackup(db,{databaseUrl:env.DATABASE_URL,filesDirectory:env.PORTAL_FILES_PATH,backupDirectory:env.PORTAL_BACKUP_PATH,encryptionKey:env.PORTAL_BACKUP_KEY,retentionDays:policy.retention_days});}catch(e){console.error('portal_scheduled_job_failed',e.code||e.name);}finally{running=false;}},60000);
 server.listen(Number(env.PORT||10000),'0.0.0.0',()=>console.log('UKR portal ready; mail transport is not enabled'));
 const stop=()=>{if(timer)clearInterval(timer);server.close(async()=>{await db.close();});};process.once('SIGTERM',stop);return {server,db,stop};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))start().catch(e=>{console.error('UKR portal startup failed',e.code||e.message);process.exitCode=1;});
