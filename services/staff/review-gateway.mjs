/** Private, expiring UAT access. No email-only authentication against operational records. */
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import http from 'node:http';
import {openDatabase,migrate,requireSchema} from './phase1/db.mjs';
import {readConfig} from './phase1/core.mjs';
import {createPortalHandler} from './phase1/http.mjs';
import {browserBundle} from './phase1/i18n.mjs';
export const REVIEW_SCHEMA='ukr_portal_test';
export const REVIEW_RELEASE='private-review-1234-v1';
export const REVIEW_CUSTOMERS=Object.freeze(['customer@ukr.test','second.customer@ukr.test']);
const hash=v=>createHash('sha256').update(v).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function reviewConfig(env){
 if(env.PORTAL_REVIEW_ENABLED!=='true')throw Error('Private review is not enabled');
 if(!['development','test'].includes(env.NODE_ENV)||env.AUTH_TEST_MODE!=='true')throw Error('Review requires explicit nonproduction test authentication');
 const origin=env.APP_ORIGIN;
 const local=env.NODE_ENV==='test'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(origin||'');
 if(origin!=='https://ukr-staff-staging.onrender.com'&&!local)throw Error('Review is restricted to the approved staging host');
 if(env.PORTAL_REVIEW_SCHEMA!==REVIEW_SCHEMA)throw Error('Isolated review schema is required');
 if(!/^[a-f0-9]{64}$/.test(env.PORTAL_REVIEW_ACCESS_HASH||'')||!/^[a-f0-9]{64}$/.test(env.PORTAL_REVIEW_KEY||''))throw Error('Private review credentials are required');
 const expires=Date.parse(env.PORTAL_REVIEW_EXPIRES_AT||'');
 if(!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+15*86400000)throw Error('Review access needs an expiry within fifteen days');
 if(!env.DATABASE_URL)throw Error('Dedicated UKR PostgreSQL connection is required');
 return Object.freeze({origin,expires,key:Buffer.from(env.PORTAL_REVIEW_KEY,'hex'),accessHash:env.PORTAL_REVIEW_ACCESS_HASH,secure:!local,schema:REVIEW_SCHEMA});
}
const signature=(c,payload)=>createHmac('sha256',c.key).update('review-gate\0'+payload).digest('base64url');
export function issueGate(c,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({expires:Math.min(now+8*3600000,c.expires),nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return payload+'.'+signature(c,payload);
}
export function validGate(c,value,now=Date.now()){
 if(typeof value!=='string'||value.length>350||now>=c.expires)return false;
 const [payload,mac,extra]=value.split('.');if(extra||!payload||!equal(mac,signature(c,payload)))return false;
 try{const v=JSON.parse(Buffer.from(payload,'base64url'));return Number.isSafeInteger(v.expires)&&v.expires>now&&v.expires<=c.expires&&/^[a-f0-9]{32}$/.test(v.nonce);}catch{return false;}
}
export async function initializeReview(store){
 const actual=await store.query('SELECT current_schema() AS name');
 if(actual.rows[0]?.name!==REVIEW_SCHEMA)throw Error('Refusing review migrations outside the isolated schema');
 await migrate(store);await requireSchema(store);
 const check=await store.query("SELECT table_schema FROM information_schema.tables WHERE table_name='users' AND table_schema=current_schema()");
 if(check.rows[0]?.table_schema!==REVIEW_SCHEMA)throw Error('Review namespace verification failed');
}
const assets={
 '/review-entry.js':['../../apps/shared/review-entry.js','text/javascript; charset=utf-8'],
 '/portal.js':['../../apps/shared/portal.js','text/javascript; charset=utf-8'],
 '/portal-admin.js':['../../apps/shared/portal-admin.js','text/javascript; charset=utf-8'],
 '/portal-review.js':['../../apps/shared/portal-review.js','text/javascript; charset=utf-8'],
 '/portal.css':['../../apps/shared/portal.css','text/css; charset=utf-8'],
 '/logo.svg':['../../site/assets/ukr-shipping-blue.svg','image/svg+xml']
};
const gateHTML=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="ukr-release" content="${REVIEW_RELEASE}"><title>UKR private portal access</title><link rel="stylesheet" href="/portal.css"><script src="/review-entry.js" defer></script></head><body><section id="authView"><div class="auth-brand"><img src="/logo.svg" width="230" alt="UKR Shipping"><h1>UKR SEA SHIPPING CO LLC</h1><a href="https://ukr-booking-lab.onrender.com/">UKR Booking Lab</a></div><main class="auth-card"><label id="reviewLanguageLabel" for="reviewLanguage">Language</label><select id="reviewLanguage"></select><h2 id="reviewTitle">Private test workspace</h2><p id="reviewIntro">Open your private access link to review the portals. Code 1234 alone does not unlock this workspace.</p><form id="reviewUnlock"><label><span id="reviewKeyLabel">Private access key</span><input name="key" type="password" required maxlength="100" autocomplete="off"></label><button id="reviewButton" type="submit">Open workspace</button></form><p id="reviewMessage" role="status"></p><p id="reviewError" class="error" role="alert"></p><p id="reviewWarning">Use test records only. No email is sent.</p></main></section></body></html>`;
function headers(res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");}
async function body(req){if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Error('json');let size=0,parts=[];for await(const b of req){size+=b.length;if(size>65536)throw Error('size');parts.push(b);}const bytes=Buffer.concat(parts),data=JSON.parse(bytes);if(!data||Array.isArray(data)||typeof data!=='object')throw Error('body');return {data,bytes};}
const gateName=c=>c.secure?'__Host-ukr_review':'ukr_review_local';
const cookieValue=(req,name)=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
const cookie=(c,value)=>`${gateName(c)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${c.secure?'; Secure':''}`;
export async function reviewHandler({store,c,env,passwords,legacyFactory,legacyHandler=null}){
 const config=readConfig({...env,PORTAL_ENCRYPTION_KEY:env.PORTAL_REVIEW_KEY,SETUP_TOKEN_HASH:c.accessHash,SETUP_EXPIRES_AT:String(c.expires)});
 const portal=await createPortalHandler({store,config,passwords,legacyFactory});
 return async(req,res)=>{
  headers(res);const reply=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   let path=new URL(req.url,c.origin).pathname;const read=['GET','HEAD'].includes(req.method);
   const reviewPath=path.startsWith('/api/portal/')||path.startsWith('/api/review/')||path.startsWith('/portal')||['/staff','/staff/','/staff.html','/customer','/customer/','/review-entry.js','/logo.svg','/healthz'].includes(path);
   if(legacyHandler&&!reviewPath)return legacyHandler(req,res);
   if(path==='/healthz')return reply({status:Date.now()<c.expires?'ready':'review_expired',release:REVIEW_RELEASE,privateReview:true,operationalData:false});
   if(path==='/api/portal/status'&&read)return reply({release:REVIEW_RELEASE,signInAvailable:validGate(c,cookieValue(req,gateName(c))),privateReview:true,emailDeliveryConfigured:false});
   if(path==='/review-entry.js'&&read){res.setHeader('Content-Type',assets[path][1]);return res.end(req.method==='HEAD'?'':await readFile(new URL(assets[path][0],import.meta.url)));}
   if(path==='/api/review/unlock'&&req.method==='POST'){
    if(req.headers.origin!==c.origin)return reply({error:'untrusted_origin'},403);
    const {data}=await body(req),now=Date.now();
    const address=req.socket?.remoteAddress||'unknown',limitKey='gate:'+hash(address);
    const allow=await store.tx(async db=>{
     const row=(await db.query('SELECT * FROM auth_limits WHERE key=$1',[limitKey])).rows[0];
     if(row&&+new Date(row.window_end)>now){await db.query('UPDATE auth_limits SET hits=LEAST(hits+1,31) WHERE key=$1',[limitKey]);return row.hits<30;}
     await db.query('INSERT INTO auth_limits(key,hits,window_end) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=1,window_end=EXCLUDED.window_end',[limitKey,new Date(now+900000)]);return true;
    });if(!allow)return reply({error:'too_many_requests'},429);
    if(now>=c.expires||typeof data.key!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.key)||!equal(hash(data.key),c.accessHash))return reply({error:'private_access_required'},403);
    const needsSetup=Number((await store.query('SELECT count(*) AS n FROM staff_users')).rows[0].n)===0;
    res.setHeader('Set-Cookie',cookie(c,issueGate(c)));return reply({ok:true,needsSetup});
   }
   const granted=validGate(c,cookieValue(req,gateName(c)));
   if(!granted){
    if(path.startsWith('/api/'))return reply({error:'private_access_required'},401);
    if((path==='/'||['/staff','/staff/','/staff.html','/customer','/customer/','/portal.html'].includes(path))&&read){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(req.method==='HEAD'?'':gateHTML);}
    if(!['/logo.svg','/portal.css'].includes(path))return reply({error:'not_found'},404);
   }
   if(path==='/portal-i18n.js'&&read){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(req.method==='HEAD'?'':browserBundle());}
   if(assets[path]&&read){let content=req.method==='HEAD'?'':await readFile(new URL(assets[path][0],import.meta.url));if(path==='/portal.js'&&req.method!=='HEAD'){content=content.toString().replace("fetch('/api/'+({setup:","fetch('/api/review/'+({setup:").replace("action=null;actionToken=null;form.reset();","action=null;actionToken=null;form.elements.name.required=false;form.reset();");}res.setHeader('Content-Type',assets[path][1]);return res.end(content);}
   if(['/staff','/customer'].includes(path)&&read){res.writeHead(308,{Location:path+'/'});return res.end();}
   if(path==='/'&&read){res.writeHead(302,{Location:'/staff/'});return res.end();}
   if(['/staff/','/customer/'].includes(path)&&read){
    const file=path==='/staff/'?'../../apps/staff/portal.html':'../../apps/customer/index.html';let html=await readFile(new URL(file,import.meta.url),'utf8');
    html=html.replace('</head>',`<meta name="ukr-release" content="${REVIEW_RELEASE}"><meta name="ukr-review" content="private"><script src="/portal-admin.js" defer></script><script src="/portal-review.js" defer></script></head>`);
    res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(req.method==='HEAD'?'':html);
   }
   if(path==='/api/portal/auth/start'&&req.method==='POST'){
    if(req.headers.origin!==c.origin)return reply({error:'untrusted_origin'},403);
    const {data,bytes}=await body(req);
    if(data.kind==='customer'&&!REVIEW_CUSTOMERS.includes(String(data.email||'').trim().toLowerCase()))return reply({error:'review_customer_required'},400);
    const replay=Readable.from([bytes]);Object.assign(replay,{url:req.url,method:req.method,headers:req.headers,socket:req.socket});return portal(replay,res);
   }
   if(['/api/review/setup','/api/review/accept-invite','/api/review/reset-password'].includes(path)){req.url=path.replace('/api/review/','/api/');}
   return portal(req,res);
  }catch{if(!res.headersSent)reply({error:'service_unavailable'},503);else res.end();}
 };
}
export async function startReview({env=process.env,passwords,legacyFactory,legacyHandler=null,publicStore=null}){
 const c=reviewConfig(env);
 const admin=await openDatabase(env.DATABASE_URL,{max:1});
 try{if(env.PORTAL_REVIEW_INITIALIZE==='true')await admin.query('CREATE SCHEMA IF NOT EXISTS '+REVIEW_SCHEMA);}
 finally{await admin.close();}
 const store=await openDatabase(env.DATABASE_URL,{options:'-c search_path='+REVIEW_SCHEMA,max:3});
 try{await initializeReview(store);}catch(e){await store.close();throw e;}
 const handler=await reviewHandler({store,c,env,passwords,legacyFactory,legacyHandler}),server=http.createServer(handler);
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(env.PORT||10000),'0.0.0.0',resolve);});
 console.log('UKR_PRIVATE_REVIEW '+JSON.stringify({release:REVIEW_RELEASE,schema:REVIEW_SCHEMA,expiresAt:new Date(c.expires).toISOString(),emailSending:false,operationalRecordsImported:false,privateGate:true,staffPasswordRequired:true,customerEmailsRestricted:true}));
 const stop=()=>new Promise(resolve=>server.close(async()=>{await store.close();await publicStore?.close();resolve();}));process.once('SIGTERM',()=>{void stop();});return {server,store,stop};
}
