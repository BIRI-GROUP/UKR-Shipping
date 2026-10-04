/** A public test workspace, not real account authentication. Operational login stays unchanged. */
import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {openDemoStore,identities,schema} from './store.mjs';
import {api} from '../phase1/api.mjs';
import {actorFor} from '../phase1/rbac.mjs';
import {loadLegacyRoleNames} from '../phase1/users.mjs';
import {one,must,readConfig} from '../phase1/core.mjs';
import {readBody} from '../phase1/http.mjs';
const scrypt=promisify(scryptCallback), hash=v=>createHash('sha256').update(String(v)).digest('hex');
const freshToken=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const release='username-demo-1';
export function demoConfiguration(env) {
  if(env.UKR_USERNAME_DEMO!=='true')return null;
  const origin=new URL(env.APP_ORIGIN||'https://ukr-staff-staging.onrender.com');
  const local=env.NODE_ENV==='test'&&['127.0.0.1','localhost'].includes(origin.hostname);
  if(!local&&(origin.origin!=='https://ukr-staff-staging.onrender.com'||env.RENDER_SERVICE_ID!=='srv-dasko9gjo6nc73c7lodg'))throw Error('Demo requires the designated test service');
  const expires=Date.parse(env.UKR_DEMO_EXPIRES_AT||'');
  if(!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+15*86400000)throw Error('Demo expiry must be within fifteen days');
  return {origin:origin.origin,secure:!local,expires};
}
const files={
 '/staff/':['../../../apps/staff/portal.html','text/html; charset=utf-8'],
 '/customer/':['../../../apps/customer/index.html','text/html; charset=utf-8'],
 '/portal-demo.js':['../../../apps/shared/portal-demo.js','text/javascript; charset=utf-8'],
 '/portal.js':['../../../apps/shared/portal.js','text/javascript; charset=utf-8']
};
export async function createUsernameDemo({env=process.env,openStore=openDemoStore}) {
  const settings=demoConfiguration(env);if(!settings)return null;
  const store=await openStore(env.DATABASE_URL);
  await loadLegacyRoleNames(store);
  const salt=randomBytes(16),expected=Buffer.from(await scrypt('1234',salt,64));
  // This config is never passed to the production authentication implementation.
  const config={...readConfig({NODE_ENV:'development',APP_ORIGIN:settings.origin}),ownerEmail:identities.admin,testMode:false,emailSending:false};
  const cookieName=kind=>(settings.secure?'__Host-':'')+'ukr_demo_'+kind;
  const cookie=(kind,value,age)=>`${cookieName(kind)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${settings.secure?'; Secure':''}`;
  const getCookie=(req,kind)=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(kind)+'='))?.slice(cookieName(kind).length+1)||'';
  const headers=res=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");};
  const json=(res,data,status=200)=>{headers(res);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));return true;};
  async function login(req,data) {
    const username=typeof data.username==='string'?data.username.trim().toLowerCase():'';
    const kind=username==='admin'?'staff':username==='customer'?'customer':null;
    const limited=await store.tx(async db=>{
      const key=hash('demo:'+String(req.socket.remoteAddress));
      await db.query('DELETE FROM demo_limits WHERE expires_at<now()');
      const limit=await one(db,'INSERT INTO demo_limits(key,hits,expires_at) VALUES($1,1,now()+interval \'15 minutes\') ON CONFLICT(key) DO UPDATE SET hits=demo_limits.hits+1 RETURNING hits',[key]);
      return limit.hits>100;
    });must(!limited,429,'too_many_requests');
    must(typeof data.password==='string'&&data.password.length<=128,401,'invalid_credentials');
    const actual=Buffer.from(await scrypt(data.password,salt,64));
    must(timingSafeEqual(actual,expected)&&kind&&req.headers['x-ukr-portal']===kind,401,'invalid_credentials');
    const raw=freshToken(),csrf=freshToken(),expires=new Date(Math.min(Date.now()+8*3600000,settings.expires));
    await store.tx(async db=>{
      const user=await one(db,'SELECT id FROM users WHERE email=$1 AND state=\'active\' AND deleted_at IS NULL',[identities[username]]);must(user,401,'invalid_credentials');
      const old=getCookie(req,kind);if(old)await db.query('DELETE FROM demo_sessions WHERE token_hash=$1',[hash(old)]);
      await db.query('DELETE FROM demo_sessions WHERE expires_at<now()');
      await db.query('INSERT INTO demo_sessions(token_hash,user_id,kind,csrf,expires_at) VALUES($1,$2,$3,$4,$5)',[hash(raw),user.id,kind,csrf,expires]);
    });return {raw,csrf,kind};
  }
  console.log('UKR_USERNAME_DEMO '+JSON.stringify({release,schema,operationalAccess:false,emailsSent:0}));
  return {close:()=>store.close(),async handle(req,res) {
    const url=new URL(req.url,settings.origin),path=url.pathname,method=req.method,read=['GET','HEAD'].includes(method);
    if(!files[path]&&!path.startsWith('/api/portal/'))return false;
    try {
      must(Date.now()<settings.expires,503,'demo_expired');
      if(path==='/api/portal/status'&&read)return json(res,{release:'portal-access-2026-10-04',demoRelease:release,signInAvailable:true,emailDeliveryConfigured:false,demo:true});
      if(files[path]&&read) {
        const [file,type]=files[path];let content=await readFile(new URL(file,import.meta.url),'utf8');
        if(path==='/portal.js') {
          const needle="...(state.csrf?";if(content.split(needle).length!==2)throw Error('Portal request integration changed');
          content=content.replace(needle,"'X-UKR-Portal':state.kind,"+needle);
        }
        if(type.startsWith('text/html')) {
          content=content.replace('</head>','<style>.demo-notice{margin:0;padding:12px 20px;background:#fff3cc;color:#5e4200;font:14px/1.6 Arial,sans-serif;text-align:center;position:relative;z-index:5}.auth-card #demoLoginHint{font-family:monospace;direction:ltr}.form-grid{min-width:0}</style><script src="/portal-admin.js" defer></script><script src="/portal-demo.js?v=1" defer></script></head>');
          content=content.replace('data-t="Email">Email','data-t="Username">Username').replace('name="email" type="email"','name="username" type="text"');
          content=content.replace('minlength="12"','minlength="4"');
          content=content.replace('<body ','<body data-username-demo="true" ');
        }
        headers(res);res.writeHead(200,{'Content-Type':type});res.end(method==='HEAD'?'':content);return true;
      }
      if(!read)must(req.headers.origin===settings.origin,403,'untrusted_origin');
      const data=read?{}:await readBody(req);
      if(path==='/api/portal/demo/login'&&method==='POST') {
        const result=await login(req,data);res.setHeader('Set-Cookie',cookie(result.kind,result.raw,Math.min(28800,Math.floor((settings.expires-Date.now())/1000))));
        return json(res,{kind:result.kind,csrf:result.csrf,demo:true});
      }
      const kind=req.headers['x-ukr-portal'];must(['staff','customer'].includes(kind),401,'sign_in_required');
      const raw=getCookie(req,kind);must(/^[A-Za-z0-9_-]{43}$/.test(raw),401,'sign_in_required');
      const p=path.slice('/api/portal'.length);
      const result=await store.tx(async db=>{
        const session=await one(db,'SELECT * FROM demo_sessions WHERE token_hash=$1 AND kind=$2 AND expires_at>now()',[hash(raw),kind]);must(session,401,'sign_in_required');
        if(!read)must(equal(req.headers['x-csrf-token'],session.csrf),403,'csrf_failed');
        const actor=await actorFor(db,session.user_id);must(actor.kind===kind&&actor.email===(kind==='staff'?identities.admin:identities.customer),401,'sign_in_required');
        if(p==='/logout'&&method==='POST'){await db.query('DELETE FROM demo_sessions WHERE id=$1',[session.id]);return {ok:true};}
        // Shared test passwords can never configure providers, invite people or alter logins.
        if(p.startsWith('/auth/')||p.startsWith('/settings/mail-accounts')||p.startsWith('/scheduler/')||p.startsWith('/customer/invites')||p.startsWith('/customer/accept-invite')||p.startsWith('/customer/disable-member')||(!read&&/^\/settings\/(users|recovery|roles|outbox)/.test(p)))must(false,403,'demo_action_unavailable');
        if(p.startsWith('/masters/'))must(['companies','warehouses','accounts','products_services','currencies','tax_rates','themes','exchange_rate_rules'].includes(p.split('/')[2]),404,'not_found');
        if(p==='/demo/customer'&&read&&kind==='staff')return one(db,"SELECT c.id,c.phone,co.legal_name,u.email FROM customers c JOIN users u ON u.id=c.user_id JOIN customer_memberships m ON m.customer_id=c.id JOIN customer_companies co ON co.id=m.customer_company_id WHERE u.email=$1",[identities.customer]);
        if(p==='/customer/company'&&!read)must(false,403,'demo_action_unavailable');
        const out=await api({db,context:{actor,csrf:session.csrf},config,auth:{},path:p,method,data,url});
        if(p==='/me')Object.assign(out,{demo:true,testMode:false});
        return out;
      });
      if(p==='/logout')res.setHeader('Set-Cookie',cookie(kind,'',0));
      return json(res,result);
    }catch(error){return json(res,{error:error.status?error.code:'service_unavailable'},error.status||503);}
  }};
}
