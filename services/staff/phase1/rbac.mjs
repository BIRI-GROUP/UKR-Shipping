import {all,one,fail,must,uuid} from './core.mjs';
import {protectedModules} from './catalog.mjs';
export async function actorFor(db,userId) {
  const user=await one(db,'SELECT id,email,display_name,kind,state,staff_user_id,auth_version,department,country_code,preferred_language,version,legacy_customer_id FROM users WHERE id=$1 AND deleted_at IS NULL',[userId]);
  if(!user || !['active','pending'].includes(user.state) || (user.kind==='staff'&&user.state!=='active'))fail(401,'sign_in_required');
  if(user.kind==='staff'){
    const staff=await one(db,'SELECT id,active FROM staff_users WHERE id=$1',[user.staff_user_id]);if(!staff?.active)fail(401,'sign_in_required');
  }
  const roles=await all(db,'SELECT r.id,r.code,r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND ur.deleted_at IS NULL AND r.deleted_at IS NULL',[user.id]);
  const grants=await all(db,'SELECT DISTINCT p.module,p.action,rp.scope FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1 AND ur.deleted_at IS NULL AND r.deleted_at IS NULL AND rp.deleted_at IS NULL AND p.deleted_at IS NULL',[user.id]);
  const warehouses=await all(db,'SELECT w.id FROM user_warehouses uw JOIN warehouses w ON w.id=uw.warehouse_id WHERE uw.user_id=$1 AND uw.deleted_at IS NULL AND w.deleted_at IS NULL AND w.active=true',[user.id]);
  const currencies=await all(db,'SELECT currency FROM user_currencies WHERE user_id=$1 AND deleted_at IS NULL',[user.id]);
  return {...user,roles,grants,warehouseIds:warehouses.map(w=>w.id),currencies:currencies.map(c=>c.currency),super:roles.some(r=>r.code==='super_admin')};
}
export function can(actor,module,action,row=null){
  if(actor.kind!=='staff')return module==='preferences'&&['view','edit'].includes(action)&&(!row||row.user_id===actor.id);
  if(actor.super)return true;
  if(protectedModules.includes(module))return false;
  return actor.grants.some(g=>g.module===module&&g.action===action&&(!row || g.scope==='all' ||
    (g.scope==='self' && (row.user_id===actor.id||row.id===actor.id)) ||
    (g.scope==='warehouse'&&row.warehouse_id&&actor.warehouseIds.includes(row.warehouse_id)) ||
    (g.scope==='assigned'&&(row.assignee_id===actor.id||row.user_id===actor.id||row.created_by===actor.id||(!row.assignee_id&&actor.roles.some(r=>r.id===row.owner_role_id))))));
}
export const requirePermission=(actor,module,action,row=null)=>{if(!can(actor,module,action,row))fail(403,'access_denied');};
export function taskScope(actor,first=1){
  requirePermission(actor,'tasks','view');if(actor.super||actor.grants.some(g=>g.module==='tasks'&&g.action==='view'&&g.scope==='all'))return {sql:'true',values:[]};
  const allowed=actor.grants.filter(g=>g.module==='tasks'&&g.action==='view').map(g=>g.scope),parts=[],values=[];
  const param=value=>{values.push(value);return '$'+(first+values.length-1);};
  if(allowed.includes('warehouse'))parts.push('warehouse_id=ANY('+param(actor.warehouseIds)+'::uuid[])');
  if(allowed.includes('assigned')||allowed.includes('self')){const user=param(actor.id),roles=param(actor.roles.map(r=>r.id));parts.push('(assignee_id='+user+' OR created_by='+user+' OR (assignee_id IS NULL AND owner_role_id=ANY('+roles+'::uuid[])))');}
  return {sql:parts.length?'('+parts.join(' OR ')+')':'false',values};
}
export function ratePermission(actor,action,rule){
  requirePermission(actor,'exchange_rates',action);
  if(!actor.super&&!actor.grants.some(g=>g.module==='exchange_rates'&&g.action===action&&g.scope==='all'))must(actor.currencies.includes(rule.base_currency),403,'access_denied');
}
export async function validateAssignee(db,actor,userId,warehouseId){
  if(!userId)return;
  const target=await actorFor(db,uuid(userId));must(target.kind==='staff',400,'invalid_assignee');
  if(warehouseId&&target.roles.some(r=>['warehouse','china_warehouse','china_manager'].includes(r.code)))must(target.warehouseIds.includes(warehouseId),400,'warehouse_access_required');
  if(!actor.super&&!can(actor,'tasks','edit',{assignee_id:userId,warehouse_id:warehouseId}))must(userId===actor.id,403,'access_denied');
}
export async function companyFor(db,actor){
  must(actor.kind==='customer',403,'access_denied');
  return one(db,`SELECT c.id AS customer_id,c.status AS customer_status,m.id AS membership_id,m.role,m.status AS membership_status,co.id,co.legal_name,co.status,co.domain,co.domain_verified_at,co.country_code,co.address,co.phone,co.tax_number,co.version
    FROM customers c LEFT JOIN customer_memberships m ON m.customer_id=c.id AND m.deleted_at IS NULL AND m.status<>'disabled'
    LEFT JOIN customer_companies co ON co.id=m.customer_company_id AND co.deleted_at IS NULL AND co.status<>'disabled'
    WHERE c.user_id=$1 AND c.deleted_at IS NULL`,[actor.id]);
}
export function isApprover(actor,approval){return actor.kind==='staff' && approval.created_by!==actor.id && can(actor,'approvals','approve') &&
  (actor.super || (!approval.approver_user_id||approval.approver_user_id===actor.id) && actor.roles.some(r=>r.id===approval.approver_role_id));}
