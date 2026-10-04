import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createWorkspace,migrateWorkspace} from '../services/booking-lab/workspace.mjs';
import {createBookingLabHandler} from '../services/booking-lab/http.mjs';

process.env.NODE_ENV='test';
const customer={kind:'customer',subject:'customer-a'},other={kind:'customer',subject:'customer-b'};
const manager={kind:'staff',subject:'manager'},ops={kind:'staff',subject:'ops'},reader={kind:'staff',subject:'reader'};
const data=(extra={})=>({companyId:'company-a',service:'sea_fcl',origin:'CNNSA',destination:'AEJEA',readyDate:'2026-12-01',goods:'Machine parts',quantity:1,unit:'container',equipment:'40HC',...extra});
const key='request_test_key_0001';
const rejects=(fn,status,code)=>assert.rejects(fn,e=>e.status===status&&(!code||e.code===code));
async function setup(t) {
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  // Only the referenced existing staff table is required. No live database is used.
  db.exec('CREATE TABLE staff_users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at BIGINT NOT NULL)');
  const store={async query(sql,params=[]) {
    if(sql.includes('CREATE TABLE')){db.exec(sql);return {rows:[],rowCount:0};}
    const args=[],prepared=sql.replace(/\$(\d+)/g,(_,n)=>{args.push(params[Number(n)-1]);return '?';});
    const statement=db.prepare(prepared);
    if(/^\s*(SELECT|WITH)/i.test(sql)){const rows=statement.all(...args);return {rows,rowCount:rows.length};}
    return {rows:[],rowCount:Number(statement.run(...args).changes)};
  }};
  let pending=Promise.resolve();
  store.tx=fn=>{const run=pending.then(async()=>{db.exec('BEGIN');try{const result=await fn(store);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}});pending=run.catch(()=>{});return run;};
  t.after(()=>db.close());
  await migrateWorkspace(store);await migrateWorkspace(store);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM booking_lab_customers').get().n,0);
  for(const [id,role,active] of [['manager','super_admin',1],['ops','operations',1],['ops2','operations',1],['reader','management',1],['finance','accounts',1],['off','operations',0],['unknown','not_a_role',1]]){
    await store.query('INSERT INTO staff_users VALUES ($1,$2,$3,$4,$5,$6,$7)',[id,id+'@example.test',id,role,'not-a-login-hash',active,1]);
  }
  for(const id of ['company-a','company-b'])await store.query('INSERT INTO booking_lab_companies VALUES ($1,$2,1,1)',[id,id]);
  for(const [id,company,verified,approved] of [['customer-a','company-a',1,1],['customer-b','company-b',1,1],['pending','company-a',1,0],['unverified','company-a',0,1]]){
    await store.query('INSERT INTO booking_lab_customers VALUES ($1,$2,$3,$4,1,$5,1)',[id,id,id+'@example.test',verified,'en']);
    await store.query('INSERT INTO booking_lab_memberships VALUES ($1,$2,$3,1)',[id,company,approved]);
  }
  return {store,db,work:createWorkspace(store)};
}

test('empty overview uses real database counts and approved memberships',async t=>{
  const {work}=await setup(t);const result=await work.overview(customer);
  assert.equal(result.companies.length,1);assert.equal(result.companies[0].id,'company-a');
  assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),0);assert.equal(result.confirmationEnabled,false);
});
test('unauthenticated, unknown and disabled identities are rejected',async t=>{
  const {work,store}=await setup(t);
  await rejects(()=>work.overview(null),401);
  await rejects(()=>work.overview({kind:'staff',subject:'missing'}),401);
  await rejects(()=>work.overview({kind:'staff',subject:'unknown'}),403);
  await store.query('UPDATE booking_lab_customers SET active=0 WHERE id=$1',['customer-a']);
  await rejects(()=>work.overview(customer),401);
});
test('email verification and company approval are separate requirements',async t=>{
  const {work}=await setup(t);
  await rejects(()=>work.submit({kind:'customer',subject:'unverified'},data(),key),403,'email_verification_required');
  await rejects(()=>work.submit({kind:'customer',subject:'pending'},data(),key),404);
});
test('customer cannot read, create for, or list another company',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  await rejects(()=>work.detail(other,a.booking.id),404);
  await rejects(()=>work.submit(other,data(),key),404);
  assert.equal((await work.list(other)).items.length,0);
  await rejects(()=>work.list(other,{companyId:'company-a'}),404);
});
test('membership and company revocation take effect on the next operation',async t=>{
  const {work,store}=await setup(t);const a=await work.submit(customer,data(),key);
  await store.query('UPDATE booking_lab_memberships SET active=0 WHERE customer_id=$1',['customer-a']);
  await rejects(()=>work.detail(customer,a.booking.id),404);
  assert.equal((await work.list(customer)).items.length,0);
  await store.query('UPDATE booking_lab_memberships SET active=1 WHERE customer_id=$1',['customer-a']);
  await store.query('UPDATE booking_lab_companies SET active=0 WHERE id=$1',['company-a']);
  await rejects(()=>work.submit(customer,data(),key),404);
});
test('same-company approved colleagues share booking visibility',async t=>{
  const {work,store}=await setup(t);const a=await work.submit(customer,data(),key);
  await store.query('INSERT INTO booking_lab_memberships VALUES ($1,$2,1,1)',['customer-b','company-a']);
  assert.equal((await work.detail(other,a.booking.id)).booking.id,a.booking.id);
});
test('retries return one request and one submission event',async t=>{
  const {work,db}=await setup(t);const first=await work.submit(customer,data(),key);const second=await work.submit(customer,data(),key);
  assert.equal(first.booking.id,second.booking.id);assert.equal(second.replayed,true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM booking_lab_requests').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM booking_lab_events').get().n,1);
});
test('parallel retries are serialised by the transactional store',async t=>{
  const {work}=await setup(t);const items=await Promise.all([work.submit(customer,data(),key),work.submit(customer,data(),key)]);
  assert.equal(items[0].booking.id,items[1].booking.id);assert.equal(items.filter(i=>i.replayed).length,1);
});
test('a reused key with changed cargo is a conflict',async t=>{
  const {work}=await setup(t);await work.submit(customer,data(),key);
  await rejects(()=>work.submit(customer,data({quantity:2}),key),409,'request_key_conflict');
});
test('request keys are scoped to company and customer',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  const b=await work.submit(other,data({companyId:'company-b'}),key);assert.notEqual(a.booking.id,b.booking.id);
});
test('seven services retain distinct units and canonical route identifiers',async t=>{
  const {work}=await setup(t);
  const variants=[{}, {service:'sea_lcl',unit:'cbm',equipment:'',quantity:1.375},
    {service:'sea_ddp',unit:'cbm',equipment:'',origin:'CN',destination:'AE'},
    {service:'air_ddp',unit:'kg',equipment:'',origin:'CN',destination:'SA'},
    {service:'air_express',unit:'kg',equipment:'',origin:'Shanghai',destination:'Dubai'},
    {service:'land',unit:'truck',equipment:'',origin:'UAE',destination:'Oman'},
    {service:'customs',unit:'shipment',equipment:'',origin:'CA',destination:'Vancouver'}];
  for(const [i,variant] of variants.entries()){
    const result=await work.submit(customer,data(variant),key+i);
    assert.equal(result.booking.service,variant.service||'sea_fcl');assert.equal(result.booking.status,'submitted');
  }
  assert.equal((await work.list(customer)).items.length,7);
});
test('all four container sizes are separate and decimals are not rounded away',async t=>{
  const {work}=await setup(t);
  for(const equipment of ['20GP','40GP','40HC','45HC'])assert.equal((await work.submit(customer,data({equipment}),key+equipment)).booking.equipment,equipment);
  assert.equal((await work.submit(customer,data({service:'sea_lcl',equipment:'',unit:'cbm',quantity:3.125}),key+'lcl')).booking.quantity,3.125);
});
test('invalid amounts, dates, units, equipment, service and route data are rejected',async t=>{
  const {work}=await setup(t);
  for(const variant of [{quantity:0},{quantity:-1},{quantity:Infinity},{quantity:'2'},{quantity:0.5},{quantity:100001},{readyDate:'2026-02-30'},{readyDate:'tomorrow'},{unit:'kg'},{equipment:'REEFER'},{service:'__proto__'},{origin:'Shanghai'},{origin:'AEJEA'},{goods:'\u0000'}])await rejects(()=>work.submit(customer,data(variant),key),400);
  await rejects(()=>work.submit(customer,data({service:'sea_ddp',origin:'TR',destination:'AE',unit:'cbm',equipment:''}),key),400);
  await rejects(()=>work.submit(customer,data({service:'customs',origin:'XX',unit:'shipment',equipment:''}),key),400);
});
test('client-supplied role, status, price and assignee cannot be submitted',async t=>{
  const {work}=await setup(t);
  for(const variant of [{role:'super_admin'},{status:'confirmed'},{supplierCost:1},{assigneeId:'manager'},{vatApproved:true}])await rejects(()=>work.submit(customer,data(variant),key),400,'unexpected_field');
  await rejects(()=>work.submit(manager,data(),key),403,'customer_required');
});
test('manager can review and assign; customer never receives staff notes or audit identity',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  await work.review(manager,a.booking.id,{version:1,status:'under_review',assigneeId:'ops',internalNote:'Internal supplier instruction'});
  const customerView=await work.detail(customer,a.booking.id),staffView=await work.detail(manager,a.booking.id);
  assert.equal(customerView.booking.status,'under_review');assert.equal(customerView.history.length,2);
  assert.equal('internalNote' in customerView.booking,false);assert.equal('assigneeId' in customerView.booking,false);
  assert.equal(JSON.stringify(customerView).includes('Internal supplier'),false);
  assert.ok(customerView.history.every(e=>!('actorId' in e)));
  assert.equal(staffView.booking.internalNote,'Internal supplier instruction');assert.equal(staffView.history.length,4);
});
test('assigned staff only see their bookings; managers can see the review queue',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);await work.submit(other,data({companyId:'company-b'}),key);
  assert.equal((await work.list(manager)).items.length,2);assert.equal((await work.list(ops)).items.length,0);
  await work.review(manager,a.booking.id,{version:1,assigneeId:'ops'});
  assert.equal((await work.list(ops)).items.length,1);
  await rejects(()=>work.detail({kind:'staff',subject:'ops2'},a.booking.id),404);
});
test('read-only management and finance cannot change a booking',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  assert.equal((await work.list(reader)).items.length,1);
  await rejects(()=>work.review(reader,a.booking.id,{version:1,status:'under_review'}),403);
  await rejects(()=>work.list({kind:'staff',subject:'finance'}),403);
});
test('assigned operations can review but cannot reassign themselves',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  await work.review(manager,a.booking.id,{version:1,assigneeId:'ops'});
  await work.review(ops,a.booking.id,{version:2,status:'under_review'});
  await rejects(()=>work.review(ops,a.booking.id,{version:3,assigneeId:'ops2'}),403,'assignment_requires_manager');
  await rejects(()=>work.review(manager,a.booking.id,{version:3,assigneeId:'off'}),400,'invalid_assignee');
});
test('role and active state are read from the database, not identity claims',async t=>{
  const {work,store}=await setup(t);const a=await work.submit(customer,data(),key);
  await rejects(()=>work.review({...reader,role:'super_admin'},a.booking.id,{version:1,status:'under_review'}),403);
  await store.query('UPDATE staff_users SET active=0 WHERE id=$1',['manager']);
  await rejects(()=>work.detail(manager,a.booking.id),401);
});
test('version conflicts and invalid transitions leave request and history unchanged',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  await rejects(()=>work.review(manager,a.booking.id,{version:1,status:'ready_for_confirmation'}),400);
  await work.review(manager,a.booking.id,{version:1,status:'under_review'});
  await rejects(()=>work.review(manager,a.booking.id,{version:1,status:'cancelled'}),409,'record_changed');
  assert.equal((await work.detail(customer,a.booking.id)).history.length,2);
});
test('request review never grants carrier confirmation or payment privileges',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  await rejects(()=>work.review(manager,a.booking.id,{version:1,status:'confirmed'}),400);
  await rejects(()=>work.review(customer,a.booking.id,{version:1,status:'under_review'}),403);
  await work.review(manager,a.booking.id,{version:1,status:'cancelled'});
  await rejects(()=>work.review(manager,a.booking.id,{version:2,internalNote:'reopen'}),409,'request_closed');
});
test('pagination is bounded and excludes inaccessible rows',async t=>{
  const {work}=await setup(t);await work.submit(customer,data(),key);await work.submit(customer,data(),key+'x');
  const first=await work.list(customer,{limit:1});const second=await work.list(customer,{limit:1,offset:1});
  assert.equal(first.hasMore,true);assert.notEqual(first.items[0].id,second.items[0].id);
  await rejects(()=>work.list(customer,{limit:10000}),400);
});
test('failed audit insert rolls back the entire submission',async t=>{
  const {work,store,db}=await setup(t);const query=store.query;
  store.query=(sql,args)=>{if(sql.startsWith('INSERT INTO booking_lab_events'))throw new Error('test audit failure');return query(sql,args);};
  await assert.rejects(()=>work.submit(customer,data(),key),/test audit failure/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM booking_lab_requests').get().n,0);
});

async function httpFixture(t) {
  const fixture=await setup(t);const csrf='s'.repeat(43);let current={...customer,csrfToken:csrf};
  const handler=createBookingLabHandler({store:fixture.store,origin:'http://127.0.0.1',authenticate:async()=>current});
  const server=http.createServer((req,res)=>{handler(req,res).then(handled=>{if(!handled){res.writeHead(404);res.end();}}).catch(()=>{res.writeHead(500);res.end();});});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const root=`http://127.0.0.1:${server.address().port}`;
  const request=(path='/bookings',options={})=>fetch(root+'/api/booking-lab'+path,options);
  const post=(body=data(),extra={})=>({method:'POST',headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1','X-CSRF-Token':csrf,'Idempotency-Key':key,...extra},body:JSON.stringify(body)});
  return {...fixture,request,post,root,setIdentity:value=>{current=value;}};
}
test('HTTP refuses mounting without an explicit authenticator',()=>{
  assert.throws(()=>createBookingLabHandler({origin:'https://ukr-booking-lab.onrender.com'}),/authenticator/);
});
test('HTTP authentication gate cannot be bypassed by identity in JSON',async t=>{
  const {request,post,setIdentity}=await httpFixture(t);setIdentity(null);
  const result=await request('/bookings',post({...data(),role:'super_admin',subject:'manager'}));
  assert.equal(result.status,401);assert.equal((await result.json()).error.code,'sign_in_required');
});
test('HTTP writes enforce exact origin and CSRF',async t=>{
  const {request,post}=await httpFixture(t);
  assert.equal((await request('/bookings',post(data(),{Origin:'https://evil.example'}))).status,403);
  assert.equal((await request('/bookings',post(data(),{'X-CSRF-Token':'wrong'}))).status,403);
  assert.equal((await request('/bookings',post())).status,201);
  assert.equal((await request('/bookings',post())).status,200);
});
test('HTTP overview and detail return no-store responses with customer-safe data',async t=>{
  const {request,post}=await httpFixture(t);const created=await (await request('/bookings',post())).json();
  const detail=await request('/bookings/'+created.booking.id);
  assert.equal(detail.headers.get('Cache-Control'),'no-store');assert.equal(detail.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal('internalNote' in (await detail.json()).booking,false);
  assert.equal((await (await request('/me')).json()).counts.submitted,1);
});
test('HTTP rejects unsupported methods, wrong JSON types and oversized data',async t=>{
  const {request,post}=await httpFixture(t);
  assert.equal((await request('/bookings',{method:'DELETE'})).status,405);
  assert.equal((await request('/bookings',post(data(),{'Content-Type':'text/plain'}))).status,415);
  assert.equal((await request('/bookings?limit=no')).status,400);
  assert.equal((await request('/bookings',post({goods:'x'.repeat(20000)}))).status,413);
});

test('staff company filter preserves assignment restrictions',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);await work.submit(other,data({companyId:'company-b'}),key);
  await work.review(manager,a.booking.id,{version:1,assigneeId:'ops'});
  assert.equal((await work.list(manager,{companyId:'company-b'})).items.length,1);
  assert.equal((await work.list(ops,{companyId:'company-b'})).items.length,0);
});
test('no-op reviews do not produce untraceable version increments',async t=>{
  const {work}=await setup(t);const a=await work.submit(customer,data(),key);
  await rejects(()=>work.review(manager,a.booking.id,{version:1,status:'submitted'}),400,'no_changes');
  assert.equal((await work.detail(customer,a.booking.id)).booking.version,1);
});
test('staff-only audit events contain no internal-note contents',async t=>{
  const {work,db}=await setup(t);const a=await work.submit(customer,data(),key);
  await work.review(manager,a.booking.id,{version:1,internalNote:'Confidential supplier note'});
  assert.equal((await work.detail(customer,a.booking.id)).history.length,1);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM booking_lab_events').all()).includes('Confidential'),false);
});
test('factory rejects cleartext origins except explicitly local tests',()=>{
  assert.throws(()=>createBookingLabHandler({origin:'http://ukr-booking-lab.onrender.com',authenticate:async()=>null,store:{query(){},tx(){}}}),/HTTPS/);
});
