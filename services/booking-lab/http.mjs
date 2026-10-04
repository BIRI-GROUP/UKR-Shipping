import {timingSafeEqual} from 'node:crypto';
import {createWorkspace, WorkspaceError} from './workspace.mjs';

const prefix='/api/booking-lab';
const error=(status,code)=>{throw new WorkspaceError(status,code);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length>=32&&a.length<=256&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function readJSON(req) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))error(415,'json_required');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>16384)error(413,'request_too_large');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{error(400,'invalid_json');}
}
/**
 * Mount only behind a real, tested session authenticator and rate limiter.
 * authenticate(req) must validate a server session on EVERY call and return
 * {kind:'customer'|'staff', subject:databaseUserId, csrfToken:sessionSecret}.
 * Never build identity from request JSON, query strings or user-supplied identity headers.
 * This module has no default authenticator, login bypass, seed users or listening socket.
 */
export function createBookingLabHandler({store,authenticate,origin,onError=()=>{}}) {
  if(typeof authenticate!=='function')throw new TypeError('A verified server-session authenticator is required.');
  const base=new URL(origin);
  if(base.origin!==origin||!['https:','http:'].includes(base.protocol))throw new TypeError('A canonical HTTP(S) origin is required.');
  if(base.protocol!=='https:'&&!(process.env.NODE_ENV==='test'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw new TypeError('HTTPS is required outside local tests.');
  const workspace=createWorkspace(store);
  return async function handle(req,res) {
    let url;try{url=new URL(req.url,origin);}catch{return false;}
    if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return false;
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));return true;};
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Referrer-Policy','no-referrer');
    try {
      if(!['GET','POST','PATCH'].includes(req.method))error(405,'method_not_allowed');
      const identity=await authenticate(req);
      if(!identity||!['customer','staff'].includes(identity.kind)||typeof identity.subject!=='string')error(401,'sign_in_required');
      const mutation=req.method!=='GET';
      if(mutation&&req.headers.origin!==origin)error(403,'untrusted_origin');
      if(mutation&&!same(req.headers['x-csrf-token'],identity.csrfToken))error(403,'session_validation_failed');
      const path=url.pathname.slice(prefix.length);
      if(path==='/me'&&req.method==='GET')return send(200,await workspace.overview(identity));
      if(path==='/bookings'&&req.method==='GET'){
        const pagination={companyId:url.searchParams.get('companyId')||undefined};
        for(const key of ['limit','offset'])if(url.searchParams.has(key)){
          const value=url.searchParams.get(key);
          if(!/^\d+$/.test(value))error(400,'invalid_pagination');
          pagination[key]=Number(value);
        }
        return send(200,await workspace.list(identity,pagination));
      }
      if(path==='/bookings'&&req.method==='POST'){
        const result=await workspace.submit(identity,await readJSON(req),req.headers['idempotency-key']);
        return send(result.replayed?200:201,result);
      }
      const match=path.match(/^\/bookings\/([A-Za-z0-9-]{1,80})$/);
      if(match&&req.method==='GET')return send(200,await workspace.detail(identity,match[1]));
      if(match&&req.method==='PATCH')return send(200,await workspace.review(identity,match[1],await readJSON(req)));
      error(404,'not_found');
    } catch(e) {
      if(!(e instanceof WorkspaceError)){try{onError(e);}catch{}return send(500,{error:{code:'internal_error',messageKey:'workspace.internal_error'}});}
      return send(e.status,{error:{code:e.code,messageKey:`workspace.${e.code}`}});
    }
  };
}
