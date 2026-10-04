import {readFile} from 'node:fs/promises';
import {createAuth} from './auth.mjs';
import {api} from './api.mjs';
import {must,fail} from './core.mjs';
import {loadLegacyRoleNames} from './users.mjs';
const staticFiles={
 '/staff/':['../../../apps/staff/portal.html','text/html; charset=utf-8'],
 '/customer/':['../../../apps/customer/index.html','text/html; charset=utf-8'],
 '/portal.js':['../../../apps/shared/portal.js','text/javascript; charset=utf-8'],
 '/portal.css':['../../../apps/shared/portal.css','text/css; charset=utf-8'],
 '/portal-i18n.js':['../../../apps/shared/portal-i18n.js','text/javascript; charset=utf-8'],
 '/logo.svg':['../../../site/assets/ukr-shipping-blue.svg','image/svg+xml']
};
export async function readBody(req){must(req.headers['content-type']?.split(';')[0]==='application/json',415,'json_required');let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;must(length<=65536,413,'request_too_large');chunks.push(chunk);}try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));must(result&&typeof result==='object'&&!Array.isArray(result));return result;}catch{fail(400,'invalid_input');}}
export async function createPortalHandler({store,config,passwords,legacyFactory,clock=Date.now}){
 must(store?.tx&&legacyFactory,500,'invalid_configuration');await loadLegacyRoleNames(store);const auth=await createAuth({store,config,passwords,clock});
 const legacy=await legacyFactory({store,origin:config.origin,publicOrigin:'https://ukr-booking-lab.onrender.com',ownerEmail:config.ownerEmail,setupTokenHash:config.setupTokenHash,setupExpires:config.setupExpires,secure:config.secure});
 const name=config.secure?'__Host-ukr_portal':'ukr_portal_test',pendingName=config.secure?'__Host-ukr_pending':'ukr_pending_test';
 const cookie=(key,value,age)=>`${key}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${config.secure?'; Secure':''}`;
 const getCookie=(req,key)=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1)||'';
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");if(config.secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
  const json=(v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(v));};
  try{
   const url=new URL(req.url,config.origin),path=url.pathname,method=req.method,mutation=!['GET','HEAD'].includes(method);
   if(mutation)must(req.headers.origin===config.origin,403,'untrusted_origin');
   if(path==='/healthz')return json({status:'ready',phase:1,emailSending:false});
   if(path==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('User-agent: *\nDisallow: /\n');}
   if(['/','/staff.html','/portal.html'].includes(path)&&method==='GET'){res.writeHead(302,{Location:(path==='/portal.html'?'/customer/':'/staff/')+url.hash});return res.end();}
   if(staticFiles[path]&&['GET','HEAD'].includes(method)){const [file,type]=staticFiles[path];res.writeHead(200,{'Content-Type':type});return res.end(method==='HEAD'?'':await readFile(new URL(file,import.meta.url)));}
   if(['/api/setup','/api/accept-invite','/api/reset-password'].includes(path)&&method==='POST')return legacy(req,res);
   if(path==='/api/status'&&method==='GET')return legacy(req,res);
   if(!path.startsWith('/api/portal/'))fail(404,'not_found');
   const p=path.slice('/api/portal'.length),data=mutation?await readBody(req):{};
   const remote=req.socket.remoteAddress||'unknown';
   if(p==='/auth/start'&&method==='POST'){const result=await auth.begin(data.kind,data,remote);res.setHeader('Set-Cookie',cookie(pendingName,result.raw,600));return json({message:'verification_requested',cooldownSeconds:60},202);}
   if(p==='/auth/resend'&&method==='POST'){const result=await auth.resend(getCookie(req,pendingName),remote);res.setHeader('Set-Cookie',cookie(pendingName,result.raw,600));return json({message:'verification_requested',cooldownSeconds:60},202);}
   if(p==='/auth/verify'&&method==='POST'){const result=await auth.verify(getCookie(req,pendingName),data.code);res.setHeader('Set-Cookie',[cookie(name,result.kind+'.'+result.raw,result.kind==='staff'?28800:1800),cookie(pendingName,'',0)]);return json({kind:result.kind,csrf:result.csrf});}
   if(p==='/auth/test-outbox'&&method==='GET')return json(await auth.testOutbox(getCookie(req,pendingName)));
   const encoded=getCookie(req,name),split=encoded.indexOf('.'),kind=encoded.slice(0,split),raw=encoded.slice(split+1);must(['staff','customer'].includes(kind),401,'sign_in_required');
   const response=await store.tx(async db=>{const context=await auth.authenticate(db,raw,kind,req.headers['x-csrf-token'],mutation);return api({db,context,auth,config,path:p,method,data,url,now:clock()});});
   if(p==='/logout'&&method==='POST')res.setHeader('Set-Cookie',cookie(name,'',0));return json(response);
  }catch(e){if(res.headersSent)return res.end();const code=e.status?e.code:['23505','23503','23514','22P02'].includes(e.code)?'invalid_or_conflicting_record':'service_unavailable';json({error:code,details:e.status?e.details:undefined},e.status||(['23505','23503'].includes(e.code)?409:['23514','22P02'].includes(e.code)?400:503));}
 };
}
