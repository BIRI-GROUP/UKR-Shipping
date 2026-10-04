/** Publish the existing portals without enabling unauthenticated or unconfigured APIs. */
import {readFile,statfs} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {browserBundle} from './phase1/i18n.mjs';
import {readConfig} from './phase1/core.mjs';
import {inspectStorage} from './phase1/deployment-check.mjs';
import {requireSchema} from './phase1/db.mjs';
import {createPortalHandler} from './phase1/http.mjs';

export const release='portal-access-2026-10-04';
const assets={
 '/staff/':['../../apps/staff/portal.html','text/html; charset=utf-8'],
 '/customer/':['../../apps/customer/index.html','text/html; charset=utf-8'],
 '/portal.js':['../../apps/shared/portal.js','text/javascript; charset=utf-8'],
 '/portal-admin.js':['../../apps/shared/portal-admin.js','text/javascript; charset=utf-8'],
 '/portal-status.js':['../../apps/shared/portal-status.js','text/javascript; charset=utf-8'],
 '/portal.css':['../../apps/shared/portal.css','text/css; charset=utf-8'],
 '/logo.svg':['../../site/assets/ukr-shipping-blue.svg','image/svg+xml']
};
const clean=(res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
};
const json=(res,data,status=200)=>{clean(res);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));return true;};

export async function runtimeDiagnostics(env,store){
 const disk=await inspectStorage(env);
 let schema=false;try{if(store)await requireSchema(store);schema=!!store;}catch{}
 let capacity=null;if(disk.status==='pass')try{const s=await statfs('/var/data/ukr');capacity=Math.round(Number(s.blocks)*Number(s.bsize)/1e6);}catch{}
 const pg=spawnSync('pg_dump',['--version'],{encoding:'utf8',timeout:3000});
 const match=pg.status===0?pg.stdout.match(/\b(\d+\.\d+)/):null;
 // Presence flags only. Never include environment values, IPs, recipients or credentials.
 return {release,persistentDisk:disk.status==='pass',diskMegabytes:capacity,schemaVerified:schema,
  portalKeyPresent:!!env.PORTAL_ENCRYPTION_KEY,backupKeyPresent:!!env.PORTAL_BACKUP_KEY,
  smtpHostPresent:!!env.SMTP_HOST,smtpUserPresent:!!(env.SMTP_USER||env.SMTP_USERNAME),smtpPasswordPresent:!!env.SMTP_PASSWORD,
  pgDumpVersion:match?.[1]||null,production:env.NODE_ENV==='production',testAuthDisabled:env.AUTH_TEST_MODE!=='true',
  migrationsApplied:false,emailsSent:0};
}

export async function createLiveGateway({store,env=process.env,passwords,legacyFactory,diagnostics=runtimeDiagnostics}){
 const report=await diagnostics(env,store);console.log('UKR_PORTAL_RUNTIME '+JSON.stringify(report));
 let portal=null,config=null;
 try{config=readConfig(env);}catch{}
 // The existing portal is only instantiated after its real schema and disk are verified.
 if(config&&!config.testMode&&report.production&&report.persistentDisk&&report.schemaVerified){
  portal=await createPortalHandler({store,config,passwords,legacyFactory});
 }
 const ready=!!portal&&config?.emailSending===true;
 const bundle=browserBundle();
 return {report,ready,async handle(req,res){
  const url=new URL(req.url,'http://internal.invalid'),path=url.pathname,read=['GET','HEAD'].includes(req.method);
  if(['/staff','/customer'].includes(path)&&read){clean(res);res.writeHead(308,{Location:path+'/'+url.search});res.end();return true;}
  if(path==='/api/portal/status'&&read)return json(res,{release,signInAvailable:ready,emailDeliveryConfigured:config?.emailSending===true});
  if(path==='/portal-i18n.js'&&read){clean(res);res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(req.method==='HEAD'?'':bundle);return true;}
  if(assets[path]&&read){const [file,type]=assets[path];let content=req.method==='HEAD'?'':await readFile(new URL(file,import.meta.url));
   if(type.startsWith('text/html')&&req.method!=='HEAD')content=content.toString().replace('</head>','<meta name="ukr-release" content="'+release+'"><script src="/portal-admin.js" defer></script><script src="/portal-status.js" defer></script></head>');
   clean(res);res.writeHead(200,{'Content-Type':type});res.end(content);return true;}
  if(path.startsWith('/api/portal/')){
   if(!ready)return json(res,{error:path==='/api/portal/me'?'sign_in_required':portal?'email_delivery_disabled':'service_unavailable'},path==='/api/portal/me'?401:503);
   await portal(req,res);return true;
  }
  return false;
 }};
}
