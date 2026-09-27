import { randomUUID, createHash } from 'node:crypto';
import { products, currencies, validateRate, validateCargo, validateContact, estimate, routeKey, today } from './rates.mjs';
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
    return json({routes:rows.map(row=>{const r=unpack(row);return {origin:r.origin,destination:r.destination,product:r.product,validFrom:r.validFrom,validTo:r.validTo};})}),true;
  }
  if (method!=='POST' || !['/api/public/estimate','/api/public/bookings'].includes(route)) fail(404,'Not found.');
  if (!allowed.includes(req.headers.origin)) fail(403,'Untrusted request origin.');
  const data=await body(req);
  if (data.website) fail(400,'Unable to process this request.');
  if (!await consumeLimit(store,route==='/api/public/estimate'?'public-estimates':'public-bookings',route==='/api/public/estimate'?500:100)) fail(429,'Too many requests. Please try again later.');
  const cargo=validateCargo(data.search||{});
  if (route==='/api/public/estimate') {
    const rates=(await store.query('SELECT * FROM freight_rates WHERE origin_key=$1 AND destination_key=$2 AND published=1 AND valid_to >= $3',[routeKey(cargo.origin),routeKey(cargo.destination),today()])).rows.map(unpack);
    const offers=rates.map(r=>estimate(r,cargo,data.details||{})).filter(Boolean);
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
  if(!route.startsWith('/api/rates') && !route.startsWith('/api/website-bookings'))return false;
  const access=commerceAccess(user),rateMatch=route.match(/^\/api\/rates\/([\w-]+)$/),bookingMatch=route.match(/^\/api\/website-bookings\/([\w-]+)$/);
  if(route==='/api/rates' && method==='GET'){
    if(!access.canManageRates)fail(403,'Only Super Admin can manage rates at this stage.');
    json({rates:(await store.query('SELECT * FROM freight_rates ORDER BY updated_at DESC LIMIT 1000')).rows.map(unpack),products,currencies});return true;
  }
  if((route==='/api/rates' && method==='POST') || (rateMatch && method==='PATCH')){
    const rate=validateRate(data);
    const result=await store.tx(async db=>{
      if(!commerceAccess(await freshUser(db,user)).canManageRates)fail(403,'Only Super Admin can manage rates at this stage.');
      const old=rateMatch?(await db.query('SELECT * FROM freight_rates WHERE id=$1',[rateMatch[1]])).rows[0]:null;
      if(rateMatch&&!old)fail(404,'Rate not found.');
      if(old && old.version!==Number(data.version))fail(409,'This rate changed. Reopen it before saving.');
      const id=old?.id||randomUUID();
      if(rate.published){
        const overlaps=(await db.query('SELECT id FROM freight_rates WHERE origin_key=$1 AND destination_key=$2 AND product=$3 AND published=1 AND valid_from<=$4 AND valid_to>=$5 AND id<>$6',[routeKey(rate.origin),routeKey(rate.destination),rate.product,rate.validTo,rate.validFrom,id])).rows;
        if(overlaps.length)fail(409,'Another published rate covers these dates for this route/product. Adjust dates or unpublish the older rate.');
      }
      if(old)await db.query('UPDATE freight_rates SET version=version+1,origin_key=$1,destination_key=$2,product=$3,valid_from=$4,valid_to=$5,published=$6,data=$7,updated_by=$8,updated_at=$9 WHERE id=$10',[routeKey(rate.origin),routeKey(rate.destination),rate.product,rate.validFrom,rate.validTo,rate.published?1:0,JSON.stringify(rate),user.id,Date.now(),id]);
      else await db.query('INSERT INTO freight_rates (id,version,origin_key,destination_key,product,valid_from,valid_to,published,data,updated_by,updated_at) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,routeKey(rate.origin),routeKey(rate.destination),rate.product,rate.validFrom,rate.validTo,rate.published?1:0,JSON.stringify(rate),user.id,Date.now()]);
      await audit(db,user.id,rate.published?'rate.published':'rate.saved',id,`${rate.origin} → ${rate.destination}; ${rate.product}`);
      return {id,version:old?old.version+1:1};
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
