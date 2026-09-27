import { randomUUID, createHash } from 'node:crypto';
import { products, currencies, validateRate, validateCargo, validateContact, estimate, routeKey, today } from './rates.mjs';
import { readRoutes, validateRoute, resolveRoutes, canonicalCargo, quickOptions, magicCosts, decodeRate, enabledRate } from './routes.mjs';
import { saveRate } from './rate-records.mjs';
import { workbookApi } from './rate-workbook.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
const fail = (status,message) => { const e=new Error(message);e.status=status;throw e; };
const unpack = row => ({...JSON.parse(row.data),id:row.id,version:row.version,updatedAt:Number(row.updated_at)});
export const commerceAccess = user => ({canManageRates:user.role==='super_admin',canReadBookings:['super_admin','management','sales_manager','operations_manager'].includes(user.role),canManageBookings:['super_admin','sales_manager','operations_manager'].includes(user.role)});
async function sequence(db,name,prefix) {
  let row=(await db.query('SELECT value FROM ukr_sequences WHERE name=$1',[name])).rows[0];
  if (!row) { await db.query('INSERT INTO ukr_sequences (name,value) VALUES ($1,1)',[name]);row={value:1}; }
  else { row.value++;await db.query('UPDATE ukr_sequences SET value=$1 WHERE name=$2',[row.value,name]); }
  return prefix + String(row.value).padStart(6,'0');
}
const receipt = row => ({reference:row.reference,status:row.status,shipmentReference:row.shipment_ref||null,estimate:JSON.parse(row.estimate),responseDue:Number(row.response_due),message:row.status==='accepted'?'Your UKR booking is accepted. Carrier allocation and cargo verification follow.':'Request received by UKR. Staff confirmation is pending.'});
export async function publicCommerce({req,url,store,origin,publicOrigin,body,json,consumeLimit,audit}) {
  if (!url.pathname.startsWith('/api/public/')) return false;
  const allowed=[origin,publicOrigin];
  if (req.headers.origin && !allowed.includes(req.headers.origin)) fail(403,'This website is not authorized.');
  if (!store) fail(503,'Online estimates are temporarily unavailable. Please try again.');
  const route=url.pathname,method=req.method;
  if (route==='/api/public/catalog' && method==='GET') {
    const rows=(await store.query('SELECT * FROM freight_rates WHERE published=1 AND valid_to >= $1 ORDER BY origin_key,destination_key,product',[today()])).rows;
    const routes=(await readRoutes(store)).filter(r=>r.active);
    return json({routes:routes.map(({version,...r})=>r),legacyLocations:rows.map(row=>{const r=unpack(row);return {origin:r.origin,destination:r.destination};})}),true;
  }
  if (method!=='POST' || !['/api/public/estimate','/api/public/bookings','/api/public/quick','/api/public/magic'].includes(route)) fail(404,'Not found.');
  if (!allowed.includes(req.headers.origin)) fail(403,'Untrusted request origin.');
  const data=await body(req);
  if (data.website) fail(400,'Unable to process this request.');
  if (!await consumeLimit(store,route==='/api/public/bookings'?'public-bookings':'public-estimates',route==='/api/public/bookings'?100:500)) fail(429,'Too many requests. Please try again later.');
  const routes=await readRoutes(store);
  if(route==='/api/public/quick'||route==='/api/public/magic'){
    const search=data.search||{};if(typeof search.origin!=='string'||typeof search.destination!=='string'||search.origin.length>120||search.destination.length>120)fail(400,'Enter loading and discharge locations.');
    const matching=resolveRoutes(routes,search),rates=(await store.query('SELECT * FROM freight_rates WHERE published=1 AND valid_to >= $1',[today()])).rows.map(decodeRate);
    if(route==='/api/public/quick'){const ready=search.ready||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(ready)||!Number.isFinite(Date.parse(ready))||ready<today())fail(400,'Choose a current date.');json({routes:matching.map(r=>({...r,options:quickOptions(r,rates,ready)}))});return true;}
    if(matching.length!==1)fail(400,'Select one operating route for the Magic tool.');
    json(magicCosts({...data.items,ready:search.ready},matching[0],rates));return true;
  }
  const cargo=validateCargo(canonicalCargo(data.search||{},routes));
  if (route==='/api/public/estimate') {
    const rates=(await store.query('SELECT * FROM freight_rates WHERE origin_key=$1 AND destination_key=$2 AND published=1 AND valid_to >= $3',[routeKey(cargo.origin),routeKey(cargo.destination),today()])).rows.map(unpack);
    const offers=rates.filter(r=>enabledRate(r,routes)).map(r=>estimate(r,cargo,data.details||{})).filter(Boolean);
    return json({offers,calculatedAt:new Date().toISOString()}),true;
  }
  const details=validateContact(data.details||{});
  if (!/^[a-f0-9-]{36}$/i.test(data.requestKey||'')) fail(400,'Refresh this request before submitting.');
  const service=typeof data.service==='string'?data.service.slice(0,120):'Freight inquiry';
  const payload={cargo,details,rateId:data.rateId||null,rateVersion:data.rateVersion||null,service};
  const payloadHash=hash(JSON.stringify(payload));
  const existing=(await store.query('SELECT * FROM website_bookings WHERE request_key=$1',[data.requestKey])).rows[0];
  if(existing) {if(existing.payload_hash!==payloadHash)fail(409,'This submission was already used with different details.');return json(receipt(existing)),true;}
  if(!await consumeLimit(store,'booking-email:'+hash(details.contactEmail),5)) fail(429,'Too many booking requests for this email. Please try again later.');
  const result=await store.tx(async db=>{
    const duplicate=(await db.query('SELECT * FROM website_bookings WHERE request_key=$1',[data.requestKey])).rows[0];
    if(duplicate){if(duplicate.payload_hash!==payloadHash)fail(409,'This submission was already used with different details.');return receipt(duplicate);}
    let offer=null;
    if(data.rateId){
      const row=(await db.query('SELECT * FROM freight_rates WHERE id=$1',[String(data.rateId)])).rows[0];
      if(!row || row.version!==Number(data.rateVersion))fail(409,'The tariff changed. Search again and review the latest estimate before booking.');
      if(!enabledRate(unpack(row),await readRoutes(db)))fail(409,'This route or service is no longer active. Search again.');
      offer=estimate(unpack(row),cargo,details);
      if(!offer)fail(409,'This tariff is no longer available for the selected route/date. Search again.');
    }
    const automatic=offer?.status==='ESTIMATE' && offer.bookingMode==='auto' && (!cargo.ddp || offer.product.endsWith('DDP'));
    const now=Date.now(),year=new Date(now).getUTCFullYear();
    const reference=await sequence(db,'request-'+year,`UKR-BR-${year}-`);
    const shipment=automatic?await sequence(db,'shipment-'+year,`UKR-${year}-`):'';
    const record={id:randomUUID(),reference,request_key:data.requestKey,payload_hash:payloadHash,data:JSON.stringify(payload),estimate:JSON.stringify(offer),status:automatic?'accepted':'requested',shipment_ref:shipment,response_due:now+(offer?.responseMinutes||60)*60000,created_at:now,updated_at:now};
    await db.query('INSERT INTO website_bookings (id,reference,request_key,payload_hash,data,estimate,status,shipment_ref,response_due,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$10)',[record.id,reference,data.requestKey,payloadHash,record.data,record.estimate,record.status,shipment,record.response_due,now]);
    await audit(db,'website',automatic?'booking.auto_accepted':'booking.requested',record.id,reference);
    return receipt(record);
  });json(result,201);return true;
}
export async function staffCommerce({route,method,data,url,user,store,freshUser,json,audit}) {
  if(await workbookApi({route,method,data,url,user,store,freshUser,json,audit}))return true;
  if(route.startsWith('/api/routes')){
    if(user.role!=='super_admin')fail(403,'Only Super Admin can manage routes.');
    if(route==='/api/routes'&&method==='GET'){json({routes:await readRoutes(store)});return true;}
    const match=route.match(/^\/api\/routes\/([\w-]+)$/);
    if((route==='/api/routes'&&method==='POST')||(match&&method==='PATCH')){
      const normalized=validateRoute(data),result=await store.tx(async db=>{if((await freshUser(db,user)).role!=='super_admin')fail(403,'Access denied.');const old=match?(await db.query('SELECT * FROM freight_routes WHERE id=$1',[match[1]])).rows[0]:null;if(match&&!old)fail(404,'Route not found.');if(old&&old.version!==Number(data.version))fail(409,'Route changed. Reopen it.');const id=old?.id||randomUUID(),all=await readRoutes(db);if(all.some(r=>r.id!==id&&routeKey(r.origin)===routeKey(normalized.origin)&&routeKey(r.destination)===routeKey(normalized.destination)))fail(409,'This port pair already has a route. Edit that route.');if(old){const oldData=JSON.parse(old.data);if(oldData.origin!==normalized.origin||oldData.destination!==normalized.destination){const linked=(await db.query('SELECT * FROM freight_rates')).rows.map(unpack).some(r=>r.routeId===id);if(linked)fail(409,'This route has tariffs. Keep its port names and edit city aliases, or create a new route.');}await db.query('UPDATE freight_routes SET data=$1,active=$2,version=version+1,updated_at=$3 WHERE id=$4',[JSON.stringify(normalized),normalized.active?1:0,Date.now(),id]);}else await db.query('INSERT INTO freight_routes (id,version,active,data,updated_at) VALUES ($1,1,$2,$3,$4)',[id,normalized.active?1:0,JSON.stringify(normalized),Date.now()]);await audit(db,user.id,'route.saved',id,normalized.origin+' → '+normalized.destination);return {id};});json(result);return true;
    }fail(404,'Not found.');
  }
  if(!route.startsWith('/api/rates') && !route.startsWith('/api/website-bookings'))return false;
  const access=commerceAccess(user),rateMatch=route.match(/^\/api\/rates\/([\w-]+)$/),bookingMatch=route.match(/^\/api\/website-bookings\/([\w-]+)$/);
  if(route==='/api/rates' && method==='GET'){
    if(!access.canManageRates)fail(403,'Only Super Admin can manage rates at this stage.');
    json({rates:(await store.query('SELECT * FROM freight_rates ORDER BY updated_at DESC LIMIT 1000')).rows.map(unpack),products,currencies});return true;
  }
  if((route==='/api/rates' && method==='POST') || (rateMatch && method==='PATCH')){
    const result=await store.tx(async db=>{
      if(!commerceAccess(await freshUser(db,user)).canManageRates)fail(403,'Only Super Admin can manage rates at this stage.');
      return saveRate(db,data,user,audit,{id:rateMatch?.[1]||null});
    });json(result,oldStatus(rateMatch));return true;
  }
  if(route==='/api/website-bookings' && method==='GET'){
    if(!access.canReadBookings)fail(403,'Access denied.');
    const rows=(await store.query('SELECT * FROM website_bookings ORDER BY created_at DESC LIMIT 300')).rows;
    json({bookings:rows.map(r=>({id:r.id,reference:r.reference,data:JSON.parse(r.data),estimate:JSON.parse(r.estimate),status:r.status,shipmentReference:r.shipment_ref,version:r.version,responseDue:Number(r.response_due),createdAt:Number(r.created_at)}))});return true;
  }
  if(bookingMatch && method==='PATCH'){
    if(!['requested','reviewing','accepted','declined','cancelled'].includes(data.status))fail(400,'Choose a valid booking status.');
    const result=await store.tx(async db=>{
      if(!commerceAccess(await freshUser(db,user)).canManageBookings)fail(403,'Access denied.');
      const row=(await db.query('SELECT * FROM website_bookings WHERE id=$1',[bookingMatch[1]])).rows[0];
      if(!row)fail(404,'Booking not found.');if(row.version!==Number(data.version))fail(409,'This booking changed. Refresh before saving.');
      const transitions={requested:['reviewing','accepted','declined','cancelled'],reviewing:['accepted','declined','cancelled'],accepted:['cancelled'],declined:[],cancelled:[]};
      if(!transitions[row.status].includes(data.status))fail(409,'This status change is not allowed.');
      const year=new Date().getUTCFullYear();
      const shipment=row.shipment_ref||(data.status==='accepted'?await sequence(db,'shipment-'+year,`UKR-${year}-`):'');
      await db.query('UPDATE website_bookings SET status=$1,shipment_ref=$2,version=version+1,updated_at=$3 WHERE id=$4',[data.status,shipment,Date.now(),row.id]);
      await audit(db,user.id,'booking.'+data.status,row.id,row.reference);return {shipmentReference:shipment};
    });json(result);return true;
  }
  fail(404,'Not found.');
}
const oldStatus = match => match?200:201;
