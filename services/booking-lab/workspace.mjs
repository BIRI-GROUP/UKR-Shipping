import {createHash, randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {can, roles} from '../staff/policy.mjs';

/** Service-layer errors use stable keys for the shared seven-language UI. */
export class WorkspaceError extends Error {
  constructor(status, code) { super(code); this.status=status; this.code=code; }
}
const fail=(status,code)=>{throw new WorkspaceError(status,code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const units=Object.freeze({sea_fcl:'container',sea_lcl:'cbm',sea_ddp:'cbm',air_ddp:'kg',air_express:'kg',land:'truck',customs:'shipment'});
export const STATUSES=Object.freeze(['submitted','under_review','information_required','ready_for_confirmation','cancelled']);
const transitions=Object.freeze({
  submitted:['under_review','cancelled'],
  under_review:['information_required','ready_for_confirmation','cancelled'],
  information_required:['under_review','cancelled'],
  ready_for_confirmation:['under_review','cancelled'],
  cancelled:[]
});
// No confirmed/payment/space states exist in this foundation. Submission is a request only.
export async function migrateWorkspace(store) {
  const schema=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
  await store.tx(db=>db.query(schema));
}
function object(value, allowed) {
  if(!value||Array.isArray(value)||typeof value!=='object')fail(400,'invalid_request');
  if(Object.keys(value).some(key=>!allowed.includes(key)))fail(400,'unexpected_field');
  return value;
}
function text(value,max=160) {
  if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/u.test(value))fail(400,'invalid_field');
  return value.trim();
}
async function actor(db,identity) {
  // identity must come from a verified SERVER session, never req.body/query/headers.
  if(!identity||!['customer','staff'].includes(identity.kind)||typeof identity.subject!=='string')fail(401,'sign_in_required');
  const table=identity.kind==='staff'?'staff_users':'booking_lab_customers';
  const user=(await db.query(`SELECT * FROM ${table} WHERE id=$1 AND active=1`,[identity.subject])).rows[0];
  if(!user)fail(401,'sign_in_required');
  if(identity.kind==='staff'&&!roles[user.role])fail(403,'access_denied');
  if(identity.kind==='customer'&&!user.email_verified)fail(403,'email_verification_required');
  return {...user,kind:identity.kind};
}
async function membership(db,user,companyId) {
  const result=await db.query('SELECT c.id,c.name FROM booking_lab_memberships m JOIN booking_lab_companies c ON c.id=m.company_id WHERE m.customer_id=$1 AND m.company_id=$2 AND m.active=1 AND m.approved=1 AND c.active=1',[user.id,companyId]);
  if(!result.rows.length)fail(404,'not_found');
  return result.rows[0];
}
async function visible(db,user,id) {
  const row=(await db.query('SELECT * FROM booking_lab_requests WHERE id=$1',[id])).rows[0];
  if(!row)fail(404,'not_found');
  if(user.kind==='customer')await membership(db,user,row.company_id);
  else if(!can(user,'read','shipments',row))fail(404,'not_found');
  return row;
}
function dto(row,user) {
  // Allowlist, not a spread of a database row. Internal data never reaches customer DTOs.
  const value={id:row.id,reference:row.reference,companyId:row.company_id,service:row.service,
    origin:row.origin,destination:row.destination,readyDate:row.ready_date,goods:row.goods,
    quantity:Number(row.quantity),unit:row.unit,equipment:row.equipment,status:row.status,
    version:Number(row.version),createdAt:Number(row.created_at),updatedAt:Number(row.updated_at)};
  if(user.kind==='staff')Object.assign(value,{assigneeId:row.assignee_id,internalNote:row.internal_note});
  return value;
}
async function event(db,user,row,action) {
  // Do not log passwords, documents, full request bodies or internal-note text.
  await db.query('INSERT INTO booking_lab_events (id,request_id,actor_kind,actor_id,action,status,version,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),row.id,user.kind,user.id,action,row.status,row.version,row.updated_at]);
}
function normalizeBooking(input) {
  object(input,['companyId','service','origin','destination','readyDate','goods','quantity','unit','equipment']);
  if(!own(units,input.service)||input.unit!==units[input.service])fail(400,'invalid_service_or_unit');
  const quantity=input.quantity;
  if(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<=0||quantity>100000||Math.abs(quantity*1000-Math.round(quantity*1000))>0.000001)fail(400,'invalid_quantity');
  if(['container','truck','shipment'].includes(input.unit)&&!Number.isInteger(quantity))fail(400,'whole_quantity_required');
  const readyDate=text(input.readyDate,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(readyDate)||!Number.isFinite(Date.parse(readyDate+'T00:00:00Z'))||new Date(readyDate+'T00:00:00Z').toISOString().slice(0,10)!==readyDate)fail(400,'invalid_date');
  const origin=text(input.origin),destination=text(input.destination);
  if(origin.toLowerCase()===destination.toLowerCase())fail(400,'different_locations_required');
  if(['sea_fcl','sea_lcl'].includes(input.service)&&![origin,destination].every(p=>/^[A-Z]{2}[A-Z0-9]{3}$/.test(p)))fail(400,'port_code_required');
  if(['sea_ddp','air_ddp'].includes(input.service)&&(origin!=='CN'||!['AE','SA','OM','QA','KW'].includes(destination)))fail(400,'unsupported_ddp_route');
  if(input.service==='customs'&&!['AE','OM','SY','TR','GB','CA'].includes(origin))fail(400,'unsupported_customs_country');
  const equipment=input.equipment??'';
  if(input.service==='sea_fcl'?!['20GP','40GP','40HC','45HC'].includes(equipment):equipment!=='')fail(400,'invalid_equipment');
  return {companyId:text(input.companyId,128),service:input.service,origin,destination,readyDate,goods:text(input.goods,500),quantity,unit:input.unit,equipment};
}
function scope(user,companyId) {
  if(user.kind==='customer')return {sql:'company_id IN (SELECT m.company_id FROM booking_lab_memberships m JOIN booking_lab_companies c ON c.id=m.company_id WHERE m.customer_id=$1 AND m.active=1 AND m.approved=1 AND c.active=1)'+(companyId?' AND company_id=$2':''),args:companyId?[user.id,companyId]:[user.id]};
  const read=roles[user.role]?.grants.shipments?.read;
  if(!read)fail(403,'access_denied');
  const result=read==='all'?{sql:'1=1',args:[]}:{sql:'assignee_id=$1',args:[user.id]};
  if(companyId){result.args.push(text(companyId,128));result.sql+=` AND company_id=$${result.args.length}`;}
  return result;
}
export function createWorkspace(store) {
  if(typeof store?.query!=='function'||typeof store?.tx!=='function')throw new TypeError('A transactional database store is required.');
  return {
    async overview(identity) {
      return store.tx(async db=>{
        const user=await actor(db,identity),filter=scope(user);
        const counts=(await db.query(`SELECT status,COUNT(*) AS total FROM booking_lab_requests WHERE ${filter.sql} GROUP BY status`,filter.args)).rows;
        const companies=user.kind==='customer'?(await db.query('SELECT c.id,c.name FROM booking_lab_memberships m JOIN booking_lab_companies c ON c.id=m.company_id WHERE m.customer_id=$1 AND m.active=1 AND m.approved=1 AND c.active=1 ORDER BY c.name',[user.id])).rows:[];
        return {user:{id:user.id,name:user.name,kind:user.kind,language:user.language||'en'},companies,
          counts:Object.fromEntries(STATUSES.map(s=>[s,Number(counts.find(r=>r.status===s)?.total||0)])),
          capabilities:{createRequest:user.kind==='customer'&&companies.length>0,reviewRequests:user.kind==='staff'&&!!roles[user.role].grants.shipments?.write},
          confirmationEnabled:false};
      });
    },
    async list(identity,{companyId,limit=25,offset=0}={}) {
      if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0||offset>100000)fail(400,'invalid_pagination');
      return store.tx(async db=>{
        const user=await actor(db,identity);
        if(companyId&&user.kind==='customer')await membership(db,user,companyId);
        const filter=scope(user,companyId),n=filter.args.length;
        const rows=(await db.query(`SELECT * FROM booking_lab_requests WHERE ${filter.sql} ORDER BY created_at DESC,id DESC LIMIT $${n+1} OFFSET $${n+2}`,[...filter.args,limit+1,offset])).rows;
        return {items:rows.slice(0,limit).map(row=>dto(row,user)),hasMore:rows.length>limit,offset};
      });
    },
    async detail(identity,id) {
      return store.tx(async db=>{
        const user=await actor(db,identity),row=await visible(db,user,id);
        const events=(await db.query('SELECT * FROM booking_lab_events WHERE request_id=$1 ORDER BY version,created_at,id',[id])).rows;
        // Customers see status changes only; staff-only edits and actor IDs are excluded.
        const history=events.filter(e=>user.kind==='staff'||['request.submitted','request.status_changed'].includes(e.action)).map(e=>{
          const publicEvent={status:e.status,createdAt:Number(e.created_at)};
          return user.kind==='staff'?{...publicEvent,action:e.action,actorId:e.actor_id,version:Number(e.version)}:publicEvent;
        });
        return {booking:dto(row,user),history};
      });
    },
    async submit(identity,input,requestKey) {
      const data=normalizeBooking(input);
      if(typeof requestKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))fail(400,'idempotency_key_required');
      const requestHash=digest(requestKey),payloadHash=digest(JSON.stringify(data));
      return store.tx(async db=>{
        const user=await actor(db,identity);
        if(user.kind!=='customer')fail(403,'customer_required');
        await membership(db,user,data.companyId);
        const previous=(await db.query('SELECT * FROM booking_lab_requests WHERE company_id=$1 AND customer_id=$2 AND request_key_hash=$3',[data.companyId,user.id,requestHash])).rows[0];
        if(previous){if(previous.payload_hash!==payloadHash)fail(409,'request_key_conflict');return {booking:dto(previous,user),replayed:true};}
        const now=Date.now(),id=randomUUID(),reference='UKR-R-'+id.toUpperCase();
        const values=[id,reference,data.companyId,user.id,data.service,data.origin,data.destination,data.readyDate,data.goods,data.quantity,data.unit,data.equipment,'submitted',requestHash,payloadHash,now,now];
        await db.query('INSERT INTO booking_lab_requests (id,reference,company_id,customer_id,service,origin,destination,ready_date,goods,quantity,unit,equipment,status,request_key_hash,payload_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',values);
        const row=(await db.query('SELECT * FROM booking_lab_requests WHERE id=$1',[id])).rows[0];
        await event(db,user,row,'request.submitted');
        return {booking:dto(row,user),replayed:false};
      });
    },
    async review(identity,id,input) {
      object(input,['version','status','assigneeId','internalNote']);
      if(!Number.isInteger(input.version)||input.version<1)fail(400,'version_required');
      if(Object.keys(input).length===1)fail(400,'no_changes');
      return store.tx(async db=>{
        const user=await actor(db,identity);
        if(user.kind!=='staff')fail(403,'staff_required');
        const row=await visible(db,user,id);
        if(!can(user,'write','shipments',row))fail(403,'access_denied');
        if(row.version!==input.version)fail(409,'record_changed');
        if(row.status==='cancelled')fail(409,'request_closed');
        const status=input.status??row.status;
        if(!STATUSES.includes(status)||(status!==row.status&&!transitions[row.status].includes(status)))fail(400,'invalid_status_change');
        let assignee=row.assignee_id;
        if(own(input,'assigneeId')){
          if(roles[user.role].grants.shipments.write!=='all')fail(403,'assignment_requires_manager');
          assignee=input.assigneeId;
          if(assignee!==null){
            if(typeof assignee!=='string')fail(400,'invalid_assignee');
            const target=(await db.query('SELECT * FROM staff_users WHERE id=$1 AND active=1',[assignee])).rows[0];
            if(!target||!can(target,'read','shipments',{assignee_id:target.id}))fail(400,'invalid_assignee');
          }
        }
        let note=row.internal_note;
        if(own(input,'internalNote')){
          if(typeof input.internalNote!=='string'||input.internalNote.length>2000||/[\u0000]/u.test(input.internalNote))fail(400,'invalid_note');
          note=input.internalNote.trim();
        }
        if(status===row.status&&assignee===row.assignee_id&&note===row.internal_note)fail(400,'no_changes');
        const now=Date.now();
        const change=await db.query('UPDATE booking_lab_requests SET status=$1,assignee_id=$2,internal_note=$3,version=version+1,updated_at=$4 WHERE id=$5 AND version=$6',[status,assignee,note,now,id,input.version]);
        if(change.rowCount!==1)fail(409,'record_changed');
        const next={...row,status,assignee_id:assignee,internal_note:note,version:row.version+1,updated_at:now};
        if(status!==row.status)await event(db,user,next,'request.status_changed');
        if(assignee!==row.assignee_id)await event(db,user,next,'request.assigned');
        if(note!==row.internal_note)await event(db,user,next,'request.note_updated');
        return {booking:dto(next,user)};
      });
    }
  };
}
