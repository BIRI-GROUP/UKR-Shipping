// Preserve operational authentication. Optional demo sessions use only the isolated test schema.
export {createHandler,hashPassword,verifyPassword} from './legacy-server.mjs';
import {createHandler,hashPassword,verifyPassword} from './legacy-server.mjs';
import {postgresStore} from './store.mjs';
import {createUsernameDemo} from './demo/gateway.mjs';
import http from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function startService(env=process.env){
 const origin=env.APP_ORIGIN||'https://ukr-staff-staging.onrender.com';
 const store=env.DATABASE_URL?await postgresStore(env.DATABASE_URL):null;
 const legacy=await createHandler({store,origin,ownerEmail:env.OWNER_EMAIL,setupTokenHash:env.SETUP_TOKEN_HASH,setupExpires:Number(env.SETUP_EXPIRES_AT||0)});
 const {createLiveGateway}=await import('./live-gateway.mjs');
 const gateway=await createLiveGateway({store,env,passwords:{hashPassword,verifyPassword},legacyFactory:createHandler});
 let demo=null;
 try{demo=await createUsernameDemo({env});}
 catch(error){console.error('UKR_DEMO_START_FAILED',error.code||error.name);}
 const server=http.createServer(async(req,res)=>{
  try{
   if(demo&&await demo.handle(req,res))return;
   if(!await gateway.handle(req,res))await legacy(req,res);
  }catch{
   if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end('{"error":"service_unavailable"}');
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise(resolve=>server.listen(Number(env.PORT||10000),'0.0.0.0',resolve));
 console.log('UKR staff service ready; database='+!!store+'; operational portal sign-in='+gateway.ready+'; isolated demo='+!!demo);
 const stop=()=>new Promise(resolve=>server.close(async()=>{await demo?.close();await store?.close();resolve();}));
 process.once('SIGTERM',()=>{void stop();});return {server,store,stop};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startService().catch(e=>{console.error('UKR service startup failed',e.code||e.name);process.exitCode=1;});
