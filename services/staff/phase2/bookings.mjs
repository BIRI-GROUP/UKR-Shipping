import {id,one,all,must,fail,uuid,digest,audit,optimistic} from '../phase1/core.mjs';
import {actorFor,can,requirePermission,companyFor} from '../phase1/rbac.mjs';
import {serviceCodes} from '../phase1/catalog.mjs';
import {emit} from '../phase1/workflow.mjs';
import {validateIntake,validateETA,parsePage,customerBooking,customerEvent} from './booking-policy.mjs';

// Called only inside the existing authenticated portal transaction. Identity and grants
// are reloaded on every operation; body/query fields never decide who the actor is.
const fresh=(db,a)=>actorFor(db,uuid(a.id));
const baseSelect='SELECT b.*,s.code AS service_code FROM bookings b JOIN services s ON s.id=b.service_id';
async function customerScope(db,a) {
  const c=await companyFor(db,a);
  must(c?.customer_id&&['pending','approved'].includes(c.customer_status)&&c.id&&
    c.membership_status==='active'&&['pending','approved'].includes(c.status),403,'access_denied');
  // An unapproved company owner may submit and read its own requests, not another customer's cargo.
  must(c.status==='approved'||c.role==='owner',403,'company_not_approved');return c;
}
export async function bookingScope(db,a,{first=1,service=null}={}) {
  const values=[],p=v=>{values.push(v);return '$'+(first+values.length-1);};
  if(a.kind==='customer') {
    const c=await customerScope(db,a);let sql='b.customer_company_id='+p(c.id);
    if(c.status!=='approved')sql+=' AND b.customer_id='+p(c.customer_id);
    if(service)sql+=' AND s.code='+p(service);
    return {sql:'('+sql+')',values};
  }
  must(a.kind==='staff',403,'access_denied');
  const conditions=[];
  for(const code of service? [service]:serviceCodes) {
    const grants=a.super?[{scope:'all'}]:a.grants.filter(g=>g.module===code&&g.action==='view');
    if(!grants.length)continue;
    if(grants.some(g=>g.scope==='all')){conditions.push('s.code='+p(code));continue;}
    const scopes=[];
    if(grants.some(g=>g.scope==='assigned'||g.scope==='self'))scopes.push('b.assignee_id='+p(a.id));
    if(grants.some(g=>g.scope==='warehouse'))scopes.push('(b.warehouse_id=ANY('+p(a.warehouseIds)+'::uuid[]) OR b.destination_warehouse_id=ANY('+p(a.warehouseIds)+'::uuid[]))');
    if(scopes.length)conditions.push('(s.code='+p(code)+' AND ('+scopes.join(' OR ')+'))');
  }
  return {sql:conditions.length?'('+conditions.join(' OR ')+')':'false',values};
}
async function allowedRow(db,a,bookingId) {
  const scope=await bookingScope(db,a,{first:2});
  const row=await one(db,baseSelect+' WHERE b.id=$1 AND b.deleted_at IS NULL AND '+scope.sql,[uuid(bookingId),...scope.values]);
  must(row,404,'not_found');return row;
}
const staffBooking=row=>({id:row.id,code:row.code,source:row.source,service:row.service_code,
  customer_id:row.customer_id,customer_company_id:row.customer_company_id,contact_email:row.contact_email,
  legal_owner_name:row.legal_owner_name,phone:row.contact_phone,origin:row.origin,destination:row.destination,
  origin_country:row.origin_country,destination_country:row.destination_country,cargo_summary:row.cargo_summary,
  status:row.status,assignee_id:row.assignee_id,warehouse_id:row.warehouse_id,
  destination_warehouse_id:row.destination_warehouse_id,eta:row.eta,
  created_at:row.created_at,updated_at:row.updated_at,version:row.version});
async function detail(db,a,row) {
  const events=await all(db,`SELECT id,to_status,from_status,note,occurred_at,event_kind,eta FROM booking_status_events WHERE booking_id=$1${a.kind==='customer'?' AND customer_visible=true':''} ORDER BY occurred_at,id`,[row.id]);
  const items=await all(db,'SELECT id,box_code,description,quantity,gross_kg,length_cm,width_cm,height_cm,hs_code FROM booking_items WHERE booking_id=$1 AND deleted_at IS NULL ORDER BY created_at,id',[row.id]);
  return {booking:a.kind==='customer'?customerBooking(row):staffBooking(row),items,events:a.kind==='customer'?events.map(customerEvent):events};
}
export async function listBookings(db,actor,params=new URLSearchParams()) {
  const a=await fresh(db,actor),page=parsePage(params),scope=await bookingScope(db,a,{service:page.service});
  const where=' b.deleted_at IS NULL AND '+scope.sql;
  const count=await one(db,'SELECT count(*)::int AS total FROM bookings b JOIN services s ON s.id=b.service_id WHERE'+where,scope.values);
  const n=scope.values.length;
  const rows=await all(db,baseSelect+' WHERE'+where+` ORDER BY b.eta ASC NULLS LAST,b.created_at DESC,b.id LIMIT $${n+1} OFFSET $${n+2}`,[...scope.values,page.limit,page.offset]);
  return {items:rows.map(a.kind==='customer'?customerBooking:staffBooking),total:count.total,limit:page.limit,offset:page.offset};
}
export async function getBooking(db,actor,bookingId) {
  const a=await fresh(db,actor);return detail(db,a,await allowedRow(db,a,bookingId));
}
export async function submitBooking(db,actor,data,requestKey,now=Date.now()) {
  const a=await fresh(db,actor),input=validateIntake(data,a.kind);
  must(typeof requestKey==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(requestKey),400,'idempotency_key_required');
  const service=await one(db,'SELECT * FROM services WHERE code=$1 AND active=true AND deleted_at IS NULL',[input.service]);
  must(service,400,'service_unavailable');
  let company,customer;
  if(a.kind==='customer') {
    company=await customerScope(db,a);must(company.role!=='view_only',403,'read_only_account');
    customer=await one(db,'SELECT c.id,u.email FROM customers c JOIN users u ON u.id=c.user_id WHERE c.id=$1',[company.customer_id]);
  } else {
    requirePermission(a,input.service,'create');
    customer=await one(db,`SELECT c.id,u.email,m.customer_company_id FROM customers c JOIN users u ON u.id=c.user_id JOIN customer_memberships m ON m.customer_id=c.id WHERE c.id=$1 AND c.deleted_at IS NULL AND c.status IN ('pending','approved') AND u.deleted_at IS NULL AND u.state IN ('pending','active') AND m.status='active' AND m.deleted_at IS NULL`,[input.customer_id]);
    must(customer,404,'not_found');
    company=await one(db,"SELECT * FROM customer_companies WHERE id=$1 AND status IN ('pending','approved') AND deleted_at IS NULL",[customer.customer_company_id]);
    must(company,404,'not_found');
    // Creating a record cannot grant an assigned-only salesperson access to somebody else's account.
    must(a.super||a.grants.some(g=>g.module===input.service&&g.action==='create'&&g.scope==='all')||company.account_owner_id===a.id,403,'access_denied');
  }
  // Retry lookup precedes mutable route/warehouse checks, but follows fresh identity and company checks.
  const payloadHash=digest(JSON.stringify({input,customer_id:customer.id,company_id:company.id}));
  const previous=await one(db,'SELECT * FROM booking_submissions WHERE actor_id=$1 AND key_hash=$2',[a.id,digest(requestKey)]);
  if(previous){must(previous.payload_hash===payloadHash,409,'idempotency_conflict');const row=await allowedRow(db,a,previous.booking_id);return {...await detail(db,a,row),replayed:true};}
  if(input.route_id){const route=await one(db,'SELECT * FROM routes WHERE id=$1 AND deleted_at IS NULL',[input.route_id]);
    must(route&&route.service_id===service.id&&!['suspended','unavailable'].includes(route.status)&&route.origin_country===input.origin_country&&route.destination_country===input.destination_country&&route.origin===input.origin&&route.destination===input.destination,400,'route_unavailable');}
  for(const [warehouseId,country]of [[input.warehouse_id,input.origin_country],[input.destination_warehouse_id,input.destination_country]])if(warehouseId){
    const w=await one(db,'SELECT country_code FROM warehouses WHERE id=$1 AND active=true AND deleted_at IS NULL',[warehouseId]);must(w&&w.country_code===country,400,'invalid_warehouse');}
  const co=await one(db,'SELECT account_owner_id FROM customer_companies WHERE id=$1',[company.id]);
  let assignee=null;
  if(co.account_owner_id){const u=await one(db,"SELECT id FROM users WHERE id=$1 AND kind='staff' AND state='active' AND deleted_at IS NULL",[co.account_owner_id]);if(u){const owner=await actorFor(db,u.id);if(can(owner,input.service,'view'))assignee=u.id;}}
  const sequence=await one(db,"SELECT nextval('ukr_booking_intake_number')::text AS n");
  const code='UKR-'+new Date(now).getUTCFullYear()+'-'+sequence.n.padStart(8,'0');
  const row=await one(db,`INSERT INTO bookings(id,code,source,customer_id,customer_company_id,service_id,route_id,origin,destination,origin_country,destination_country,cargo_summary,assignee_id,legal_owner_name,contact_phone,contact_email,shipper_name,shipper_phone,shipper_email,warehouse_id,destination_warehouse_id,created_by,created_at,updated_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$23) RETURNING *`,
  [id(),code,a.kind==='staff'?'staff_booking':'customer_portal',customer.id,company.id,service.id,input.route_id,input.origin,input.destination,input.origin_country,input.destination_country,input.cargo_summary,assignee,input.legal_owner_name,input.phone,customer.email,input.shipper_name,input.shipper_phone,input.shipper_email,input.warehouse_id,input.destination_warehouse_id,a.id,new Date(now)]);
  await db.query('INSERT INTO booking_submissions(actor_id,key_hash,payload_hash,booking_id,created_by) VALUES($1,$2,$3,$4,$1)',[a.id,digest(requestKey),payloadHash,row.id]);
  await db.query("INSERT INTO booking_status_events(booking_id,to_status,customer_visible,occurred_at,created_by) VALUES($1,'submitted',true,$2,$3)",[row.id,new Date(now),a.id]);
  await emit(db,{key:'booking:'+row.id+':submitted',type:'booking.submitted',entityType:'booking',entityId:row.id,ownerUserId:assignee,facts:{code,service:input.service,status:'submitted'}},a.id,now);
  await audit(db,a.id,'booking.submitted','bookings',row.id,null,{code,source:row.source,customer_company_id:company.id,service:input.service,status:'submitted'});
  return {...await detail(db,a,{...row,service_code:input.service}),replayed:false};
}
export async function updateETA(db,actor,bookingId,data,now=Date.now()) {
  const a=await fresh(db,actor);must(a.kind==='staff',403,'access_denied');
  const old=await allowedRow(db,a,bookingId);requirePermission(a,old.service_code,'edit',old);
  const change=validateETA(data);optimistic(old,change.version);
  must(!['cancelled','declined','delivered'].includes(old.status),409,'booking_closed');
  const updated=await one(db,'UPDATE bookings SET eta=$1,version=version+1,updated_at=$2 WHERE id=$3 AND version=$4 RETURNING *',[change.eta,new Date(now),old.id,old.version]);
  must(updated,409,'record_changed');
  await db.query("INSERT INTO booking_status_events(booking_id,from_status,to_status,event_kind,eta,customer_visible,occurred_at,created_by) VALUES($1,$2,$2,'eta_changed',$3,true,$4,$5)",[old.id,old.status,change.eta,new Date(now),a.id]);
  await audit(db,a.id,'booking.eta_changed','bookings',old.id,{eta:old.eta},{eta:updated.eta},change.reason);
  return detail(db,a,{...updated,service_code:old.service_code});
}
export async function bookingApi({db,context,path,method,data,url,now}) {
  const actor=context.actor;
  if(path==='/bookings'&&method==='GET')return listBookings(db,actor,url.searchParams);
  if(path==='/bookings'&&method==='POST'){
    // The existing JSON transport uses a body request key, never email/OTP in a URL.
    const {request_key,...input}=data;return submitBooking(db,actor,input,request_key,now);
  }
  const match=path.match(/^\/bookings\/([a-f0-9-]{36})(\/eta)?$/i);
  if(match&&!match[2]&&method==='GET')return getBooking(db,actor,match[1]);
  if(match&&match[2]&&method==='PUT')return updateETA(db,actor,match[1],data,now);
  fail(404,'not_found');
}
