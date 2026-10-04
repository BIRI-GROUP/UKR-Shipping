import {must,text,email,uuid,timestamp,integer} from '../phase1/core.mjs';
import {serviceCodes} from '../phase1/catalog.mjs';

// Intake is shared by every service. It does not accept prices or operational statuses.
const fields = new Set(['service','customer_id','route_id','origin','destination',
  'origin_country','destination_country','phone','legal_owner_name','cargo_summary',
  'shipper_name','shipper_phone','shipper_email','warehouse_id','destination_warehouse_id']);
export function validateIntake(data,kind) {
  must(data && typeof data === 'object' && !Array.isArray(data));
  must(['staff','customer'].includes(kind),403,'access_denied');
  must(Object.keys(data).every(k=>fields.has(k)),400,'unsupported_booking_field');
  must(serviceCodes.includes(data.service),400,'invalid_service');
  if(kind==='customer')must(!Object.hasOwn(data,'customer_id'),403,'access_denied');
  const country=v=>{const code=text(v,2,true);must(/^[A-Z]{2}$/.test(code),400,'invalid_country');return code;};
  const result={service:data.service,customer_id:kind==='staff'?uuid(data.customer_id):null,
    route_id:data.route_id?uuid(data.route_id):null,
    origin:text(data.origin,200,true),destination:text(data.destination,200,true),
    origin_country:country(data.origin_country),destination_country:country(data.destination_country),
    phone:text(data.phone,40,true),legal_owner_name:text(data.legal_owner_name,200,true),
    cargo_summary:text(data.cargo_summary,2000,true),shipper_name:text(data.shipper_name||'',200),
    shipper_phone:text(data.shipper_phone||'',40),shipper_email:data.shipper_email?email(data.shipper_email):'',
    warehouse_id:data.warehouse_id?uuid(data.warehouse_id):null,
    destination_warehouse_id:data.destination_warehouse_id?uuid(data.destination_warehouse_id):null};
  return result;
}
export function parsePage(params) {
  const read=(name,fallback,max)=>{const raw=params.get(name);if(raw===null)return fallback;must(/^\d+$/.test(raw),400,'invalid_pagination');return integer(Number(raw),name==='limit'?1:0,max);};
  const service=params.get('service');must(!service||serviceCodes.includes(service),400,'invalid_service');
  return {limit:read('limit',30,100),offset:read('offset',0,1000000),service:service||null};
}
export function validateETA(data) {
  must(data && Object.keys(data).every(k=>['version','eta','reason'].includes(k)),400,'unsupported_booking_field');
  return {version:integer(data.version,1,2147483647),eta:data.eta===null?null:timestamp(data.eta),reason:text(data.reason,1000,true)};
}
const customerStatuses=Object.freeze({submitted:'submitted',accepted:'accepted',goods_received:'goods_received',
  ready_to_ship:'goods_received',consolidated:'goods_received',ready_for_collection:'goods_received',
  in_transit:'in_transit',on_hold:'on_hold',arrived:'arrived',customs_cleared:'customs_cleared',
  ready_for_delivery:'ready_for_delivery',out_for_delivery:'out_for_delivery',delivered:'delivered',
  cancelled:'cancelled',declined:'declined'});
export function customerStatus(status) {
  must(Object.hasOwn(customerStatuses,status),500,'invalid_booking_status');return customerStatuses[status];
}
export function customerBooking(row) {
  // Never spread a database row into the customer response, including agreement_snapshot.
  return {id:row.id,code:row.code,source:row.source,service:row.service_code,
    origin:row.origin,destination:row.destination,origin_country:row.origin_country,
    destination_country:row.destination_country,cargo_summary:row.cargo_summary,
    legal_owner_name:row.legal_owner_name,phone:row.contact_phone,status:customerStatus(row.status),
    eta:row.eta,created_at:row.created_at,updated_at:row.updated_at,version:row.version};
}
export function customerEvent(row) {
  return {id:row.id,kind:row.event_kind,status:customerStatus(row.to_status),
    note:row.note,eta:row.eta,occurred_at:row.occurred_at};
}
