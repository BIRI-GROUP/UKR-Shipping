import http from 'node:http';
import {createUsernameDemo} from '../../services/staff/demo/gateway.mjs';
import {createLiveGateway} from '../../services/staff/live-gateway.mjs';
import {openDatabase} from '../../services/staff/phase1/db.mjs';
import {schema} from '../../services/staff/demo/store.mjs';
export async function harness(){
 const connection=process.env.TEST_DATABASE_URL;
 if(process.env.NODE_ENV!=='test'||!connection||!new URL(connection).pathname.includes('test'))throw Error('Disposable PostgreSQL test database required');
 const admin=await openDatabase(connection);await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');
 let demo,base;const server=http.createServer(async(req,res)=>{try{if(await demo.handle(req,res))return;if(await base.handle(req,res))return;res.writeHead(404);res.end();}catch{res.writeHead(500);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const env={NODE_ENV:'test',UKR_USERNAME_DEMO:'true',UKR_DEMO_EXPIRES_AT:new Date(Date.now()+86400000).toISOString(),APP_ORIGIN:origin,DATABASE_URL:connection};
 demo=await createUsernameDemo({env});base=await createLiveGateway({store:null,env,diagnostics:async()=>({production:false}),passwords:{},legacyFactory:()=>{}});
 const call=async(path,{method='GET',data,kind='staff',cookie,csrf,originHeader=origin}={})=>{const res=await fetch(origin+'/api/portal'+path,{method,headers:{'X-UKR-Portal':kind,...(method==='GET'?{}:{'Content-Type':'application/json',Origin:originHeader}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 return {origin,admin,call,close:async()=>{await new Promise(r=>server.close(r));await demo.close();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.close();}};
}
