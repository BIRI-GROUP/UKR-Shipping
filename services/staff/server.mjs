// Preserve the existing API and password implementation; publish the new portal entry points.
export {createHandler,hashPassword,verifyPassword} from './legacy-server.mjs';
import {createHandler,hashPassword,verifyPassword} from './legacy-server.mjs';
import {postgresStore} from './store.mjs';
import http from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function startService(env=process.env){
 const origin=env.APP_ORIGIN||'https://ukr-staff-staging.onrender.com';
 if(env.PORTAL_REVIEW_ENABLED==='true'){
  const {reviewConfig}=await import('./review-gateway.mjs');reviewConfig(env);
 }
 const store=env.DATABASE_URL?await postgresStore(env.DATABASE_URL):null;
 const legacy=await createHandler({store,origin,ownerEmail:env.OWNER_EMAIL,setupTokenHash:env.SETUP_TOKEN_HASH,setupExpires:Number(env.SETUP_EXPIRES_AT||0)});
 if(env.PORTAL_REVIEW_ENABLED==='true'){
  const {startReview}=await import('./review-gateway.mjs');
  try{return await startReview({env,passwords:{hashPassword,verifyPassword},legacyFactory:createHandler,legacyHandler:legacy,publicStore:store});}
  catch(error){await store?.close();throw error;}
 }
 const {createLiveGateway}=await import('./live-gateway.mjs');
 const gateway=await createLiveGateway({store,env,passwords:{hashPassword,verifyPassword},legacyFactory:createHandler});
 const server=http.createServer(async(req,res)=>{
  try{if(!await gateway.handle(req,res))await legacy(req,res);}
  catch{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"service_unavailable"}');}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise(resolve=>server.listen(Number(env.PORT||10000),'0.0.0.0',resolve));
 console.log('UKR staff service ready; database='+!!store+'; portal pages published; portal sign-in='+gateway.ready);
 const stop=()=>new Promise(resolve=>server.close(async()=>{await store?.close();resolve();}));
 process.once('SIGTERM',()=>{void stop();});return {server,store,stop};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startService().catch(e=>{console.error('UKR service startup failed',e.code||e.name);process.exitCode=1;});
