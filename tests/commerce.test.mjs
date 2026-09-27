import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {validateRate,validateCargo,estimate,today} from '../services/staff/rates.mjs';
import {testStore} from '../services/staff/store.mjs';
import {createHandler,hashPassword} from '../services/staff/server.mjs';
process.env.NODE_ENV='test';
const end=new Date(Date.now()+6*86400000).toISOString().slice(0,10);
export const rateInput=(extra={})=>({origin:'Ningbo, China',destination:'Jebel Ali, UAE',product:'LCL',label:'LCL tariff',validFrom:today(),validTo:end,currency:'USD',buyRate:100,markupType:'percent',markup:20,basis:'wm',minimumUnits:1,rounding:.01,minimumCharge:0,kgPerCbm:475,volumetricDivisor:6000,originFee:10,destinationFee:10,documentationFee:5,maxWeight:30000,maxCbm:100,maxDensity:0,inclusions:'Ocean freight and listed charges',exclusions:'Duty, VAT and delivery',internalNotes:'PRIVATE SUPPLIER COST',bookingMode:'review',responseMinutes:45,published:true,...extra});
const cargoInput=(extra={})=>({origin:'Ningbo, China',destination:'Jebel Ali, UAE',ready:today(),mode:'sea',cargoType:'cartons',weight:1425,cbm:2,ddp:false,...extra});
const contact={commodity:'TEST cartons',packages:'2',contactName:'Test Customer',contactEmail:'customer@example.test',company:'Test',stackable:true,batteries:false,dangerous:false,oversized:false,consent:true};
test('commercial calculations: 475 kg sea, truck choices, air, containers and markup',()=>{
  const r=validateRate(rateInput());const c=validateCargo(cargoInput());let e=estimate(r,c);
  assert.equal(e.quantity,3);assert.equal(e.total,385);assert.equal(e.unitPrice,120);
  for(const forbidden of ['buyRate','markup','internalNotes','updatedBy'])assert.equal(forbidden in e,false);
  assert.equal(estimate(r,{...c,weight:1,cbm:.1}).quantity,1);
  assert.equal(estimate(validateRate(rateInput({minimumCharge:500})),c).total,525);
  assert.equal(validateRate(rateInput({markupType:'fixed',markup:12.5})).unitPrice,112.5);
  for(const [ratio,units,total]of [[350,2,265],[300,2.34,305.8]]){e=estimate(validateRate(rateInput({product:'ROAD_LTL',kgPerCbm:ratio})),validateCargo(cargoInput({mode:'road',weight:700,cbm:1})));assert.equal(e.quantity,units);assert.equal(e.total,total);}
  e=estimate(validateRate(rateInput({product:'AIR',basis:'volumetric_kg',buyRate:10,rounding:1})),validateCargo(cargoInput({mode:'air',weight:100,cbm:1})));assert.equal(e.quantity,167);assert.equal(e.total,2029);
  e=estimate(validateRate(rateInput({product:'FCL20',basis:'container',buyRate:1000})),validateCargo(cargoInput({cargoType:'container',containers:2,containerSize:'20GP',weight:50000})));assert.equal(e.total,2425);assert.equal(e.quantity,2);
});
test('eligibility, DDP scope, validity and malformed data do not yield misleading prices',()=>{
  const r=validateRate(rateInput()),c=validateCargo(cargoInput());
  assert.equal(estimate(r,c,{dangerous:true}).total,null);assert.equal(estimate(r,c,{stackable:false}).status,'REVIEW_REQUIRED');
  assert.equal(estimate({...r,maxDensity:500},c).total,null);
  assert.equal(estimate({...r,published:false},c),null);assert.equal(estimate({...r,validTo:'2000-01-01'},c),null);
  assert.equal(estimate(r,{...c,destination:'Dubai, UAE'}),null);assert.equal(estimate(r,{...c,ready:'2099-01-01'}),null);
  assert.throws(()=>validateRate(rateInput({product:'LCL_DDP'})),/DDP/);
  assert.throws(()=>validateRate(rateInput({validFrom:'2026-13-01'})),/date/);
  assert.throws(()=>validateRate(rateInput({buyRate:-1})),/buying/);
  assert.throws(()=>validateRate(rateInput({product:'toString'})),/product/);
});
test('rates → public calculation → booking → staff review integration',async t=>{
  const store=await testStore(),hash=await hashPassword('Local-test-only-482!');
  for(const role of ['super_admin','accounts','china_warehouse'])await store.query('INSERT INTO staff_users (id,email,name,role,password_hash,active,created_at) VALUES ($1,$2,$1,$1,$3,1,$4)',[role,role+'@example.test',hash,Date.now()]);
  const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,publicOrigin='https://public.example.test';
  server.on('request',await createHandler({store,origin,publicOrigin,secure:false}));t.after(async()=>{await new Promise(r=>server.close(r));await store.close();});
  async function req(path,method='GET',data,account,requestOrigin=origin){const r=await fetch(origin+'/api'+path,{method,headers:{Origin:requestOrigin,...(data?{'Content-Type':'application/json'}:{}),...(account?{Cookie:account.cookie,'X-CSRF-Token':account.csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:r.status===204?null:await r.json(),cookie:r.headers.get('set-cookie'),cors:r.headers.get('access-control-allow-origin'),credentials:r.headers.get('access-control-allow-credentials')};}
  async function login(role){const r=await req('/login','POST',{email:role+'@example.test',password:'Local-test-only-482!'});assert.equal(r.status,200);return {cookie:r.cookie.split(';')[0],csrf:r.data.csrf};}
  const owner=await login('super_admin'),accounts=await login('accounts'),warehouse=await login('china_warehouse');
  await t.test('only Super Admin can manage rates; public CORS does not authorize staff API',async()=>{
    assert.equal((await req('/rates','GET',null,accounts)).status,403);
    assert.equal((await req('/rates','POST',rateInput(),accounts)).status,403);
    assert.equal((await req('/rates','POST',rateInput(),owner,publicOrigin)).status,403);
    const pre=await req('/public/estimate','OPTIONS',null,null,publicOrigin);assert.equal(pre.status,204);assert.equal(pre.cors,publicOrigin);assert.equal(pre.credentials,null);
    assert.equal((await req('/public/estimate','POST',{search:cargoInput()},null,'https://evil.example')).status,403);
    assert.equal((await req('/website-bookings','GET',null,warehouse)).status,403);
  });
  let saved;
  await t.test('weekly publication and sensitive-field exclusion',async()=>{
    saved=await req('/rates','POST',rateInput(),owner);assert.equal(saved.status,201);
    assert.equal((await req('/rates','POST',rateInput(),owner)).status,409);
    const catalog=await req('/public/catalog','GET',null,null,publicOrigin);assert.equal(catalog.data.routes.length,1);assert.equal(JSON.stringify(catalog.data).includes('buyRate'),false);
    const quote=await req('/public/estimate','POST',{search:cargoInput()},null,publicOrigin);assert.equal(quote.status,200);assert.equal(quote.data.offers[0].total,385);
    assert.equal(JSON.stringify(quote.data).includes('PRIVATE'),false);assert.equal(JSON.stringify(quote.data).includes('buyRate'),false);
    assert.equal((await req('/rates/'+saved.data.id,'PATCH',{...rateInput(),version:99},owner)).status,409);
  });
  let booking;
  await t.test('booking uses server totals, saves SLA, and retries cannot duplicate',async()=>{
    const key=randomUUID(),payload={search:cargoInput(),details:contact,rateId:saved.data.id,rateVersion:1,requestKey:key,total:.01,service:'LCL tariff'};
    booking=await req('/public/bookings','POST',payload,null,publicOrigin);assert.equal(booking.status,201);assert.equal(booking.data.estimate.total,385);assert.equal(booking.data.status,'requested');assert.ok(booking.data.responseDue>Date.now()+44*60000);
    const duplicate=await req('/public/bookings','POST',payload,null,publicOrigin);assert.equal(duplicate.data.reference,booking.data.reference);
    const changed=await req('/public/bookings','POST',{...payload,details:{...contact,commodity:'different'}},null,publicOrigin);assert.equal(changed.status,409);
    const list=await req('/website-bookings','GET',null,owner);assert.equal(list.data.bookings.length,1);const b=list.data.bookings[0];assert.equal(b.data.details.contactEmail,contact.contactEmail);assert.equal(b.estimate.total,385);
    assert.equal((await req('/website-bookings/'+b.id,'PATCH',{version:1,status:'accepted'},owner)).status,200);
    const accepted=(await req('/website-bookings','GET',null,owner)).data.bookings[0];assert.match(accepted.shipmentReference,/^UKR-\d{4}-\d{6}$/);
    assert.equal((await req('/website-bookings/'+b.id,'PATCH',{version:1,status:'cancelled'},owner)).status,409);
  });
  await t.test('price changes require re-review and original booked estimate remains immutable',async()=>{
    assert.equal((await req('/rates/'+saved.data.id,'PATCH',{...rateInput(),buyRate:200,bookingMode:'auto',version:1},owner)).status,200);
    const payload={search:cargoInput(),details:contact,rateId:saved.data.id,rateVersion:1,requestKey:randomUUID()};
    assert.equal((await req('/public/bookings','POST',payload,null,publicOrigin)).status,409);
    assert.equal((await req('/website-bookings','GET',null,owner)).data.bookings[0].estimate.total,385);
    const auto=await req('/public/bookings','POST',{...payload,rateVersion:2,requestKey:randomUUID(),details:{...contact,contactEmail:'auto@example.test'}},null,publicOrigin);assert.equal(auto.data.status,'accepted');assert.match(auto.data.shipmentReference,/UKR-/);
    const special=await req('/public/bookings','POST',{...payload,rateVersion:2,requestKey:randomUUID(),details:{...contact,batteries:true,contactEmail:'special@example.test'}},null,publicOrigin);assert.equal(special.data.status,'requested');assert.equal(special.data.estimate.total,null);
    const door=await req('/public/bookings','POST',{...payload,rateVersion:2,requestKey:randomUUID(),search:{...cargoInput(),ddp:true},details:{...contact,contactEmail:'door@example.test'}},null,publicOrigin);assert.equal(door.data.status,'requested');
  });
  await t.test('draft/expired rate, consent and unauthenticated data access protections',async()=>{
    const unpublished=await req('/rates','POST',rateInput({origin:'TEST Port',published:false}),owner);assert.equal(unpublished.status,201);
    assert.equal((await req('/public/estimate','POST',{search:cargoInput({origin:'TEST Port'})},null,publicOrigin)).data.offers.length,0);
    assert.equal((await req('/public/bookings','POST',{search:cargoInput(),details:{...contact,consent:false},requestKey:randomUUID()},null,publicOrigin)).status,400);
    assert.equal((await req('/website-bookings')).status,401);
    assert.equal((await req('/public/bookings','GET',null,null,publicOrigin)).status,404);
  });
});
