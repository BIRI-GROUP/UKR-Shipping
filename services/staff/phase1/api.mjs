import {one,all,id,text,uuid,must,fail,audit,optimistic} from './core.mjs';
import {can,requirePermission,companyFor} from './rbac.mjs';
import {menu,extraModules} from './catalog.mjs';
import * as masters from './masters.mjs';
import * as users from './users.mjs';
import * as customer from './customers.mjs';
import * as work from './workflow.mjs';
import * as rates from './rates.mjs';
import * as mail from './mail.mjs';
import * as mailAccounts from './mail-accounts.mjs';
import {tick} from './jobs.mjs';
const meServiceCodes=a=>['air_ddp','sea_ddp','air_express','sea_lcl','sea_fcl','land','storage','customs'].filter(s=>can(a,s,'view'));
const safeUser=a=>({id:a.id,name:a.display_name,email:a.email,kind:a.kind,roles:a.roles,language:a.preferred_language});
export async function api({db,context,auth,config,path,method,data,url,now=Date.now()}){
 const a=context.actor,write=method!=='GET',parts=path.split('/').filter(Boolean);
 if(path==='/me'&&method==='GET')return {user:safeUser(a),csrf:context.csrf,preferences:await masters.preference(db,a),themes:await all(db,'SELECT id,code,name,tokens FROM themes WHERE active=true AND deleted_at IS NULL ORDER BY code'),menu:a.kind==='staff'?menu.filter(m=>can(a,m.id,'view')||(m.id==='settings'&&['users','roles','templates','outbox','logs','mail_accounts'].some(x=>can(a,x,'view')))):[],capabilities:a.kind==='staff'?Object.fromEntries([...new Set([...menu.map(m=>m.id),...extraModules])].map(m=>[m,['view','create','edit','approve','delete','export'].filter(action=>can(a,m,action))])):{},testMode:config.testMode};
 if(path==='/logout'&&method==='POST'){await auth.logout(db,context);return {ok:true};}
 if(path==='/preferences'&&method==='PUT')return masters.savePreference(db,a,data);
 if(a.kind==='customer'){
  if(path==='/customer/profile'&&method==='GET')return customer.customerProfile(db,a);
  if(path==='/customer/profile'&&method==='PUT')return customer.saveCustomerProfile(db,a,data);
  if(path==='/customer/company'&&method==='POST')return customer.requestCompany(db,a,data,now);
  if(path==='/customer/members'&&method==='GET')return {items:await customer.companyMembers(db,a)};
  if(path==='/customer/invites'&&method==='POST')return customer.inviteCompanyMember(db,a,data,now);
  if(path==='/customer/accept-invite'&&method==='POST')return customer.acceptCompanyInvite(db,a,data.id,now);
  if(path==='/customer/disable-member'&&method==='POST')return customer.disableCompanyMember(db,a,data.id,data.version);
  fail(403,'access_denied');
 }
 must(a.kind==='staff',403,'access_denied');
 if(path==='/overview'&&method==='GET'){
  requirePermission(a,'overview','view');const t=can(a,'tasks','view')?await work.tasks(db,a,{}):[],p=can(a,'approvals','view')?await work.approvals(db,a):[];
  const permitted=meServiceCodes(a);const jobs=await all(db,`SELECT b.id,b.status,b.assignee_id,s.code FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.deleted_at IS NULL AND s.code=ANY($1::text[]) AND (s.code=ANY($2::text[]) OR b.assignee_id=$3)`,[permitted,permitted.filter(code=>a.super||a.grants.some(g=>g.module===code&&g.action==='view'&&g.scope==='all')),a.id]);
  return {openBookings:jobs.filter(j=>!['delivered','cancelled','declined'].includes(j.status)).length,shipmentsInTransit:jobs.filter(j=>j.status==='in_transit').length,bookingsByService:Object.fromEntries(permitted.map(code=>[code,jobs.filter(j=>j.code===code&&!['delivered','cancelled','declined'].includes(j.status)).length])),tasksDueToday:t.filter(t=>['open','in_progress','suggested'].includes(t.status)&&new Date(t.due_at).toISOString().slice(0,10)===new Date(now).toISOString().slice(0,10)).length,approvalsWaiting:p.filter(p=>p.status==='pending').length,activity:t.slice(0,10),shipmentWidgetsAvailable:true};
 }
 if(path==='/masters'&&method==='GET'){requirePermission(a,'masters','view');return {masters:masters.describeMasters()};}
 if(parts[0]==='masters'&&parts.length>=2&&parts.length<=3){const name=parts[1];if(method==='GET')return {items:await masters.listMaster(db,a,name)};if(method==='POST'&&parts.length===2)return masters.saveMaster(db,a,name,data);if(method==='PUT'&&parts.length===3)return masters.saveMaster(db,a,name,data,parts[2]);if(method==='DELETE'&&parts.length===3)return masters.deleteMaster(db,a,name,parts[2],data.version);}
 if(path==='/settings/users'&&method==='GET')return {items:await users.userList(db,a)};
 if(path==='/settings/users'&&method==='POST')return users.inviteUser(db,a,config,data,now);
 if(parts[0]==='settings'&&parts[1]==='users'&&parts.length===3&&method==='PUT')return users.changeUser(db,a,parts[2],data);
 if(path==='/settings/recovery'&&method==='POST')return users.resetUser(db,a,config,data.id,now);
 if(path==='/settings/roles'&&method==='GET')return users.roleMatrix(db,a);
 if(path==='/settings/roles'&&method==='POST')return users.saveRole(db,a,data);
 if(parts[0]==='settings'&&parts[1]==='roles'&&parts.length===3&&method==='PUT')return users.saveRole(db,a,data,parts[2]);
 if(path==='/settings/logs'&&method==='GET')return {items:await users.logs(db,a,{search:url.searchParams.get('q')||''})};
 if(path==='/settings/templates'&&method==='GET'){requirePermission(a,'templates','view');return {items:await all(db,'SELECT * FROM email_templates WHERE deleted_at IS NULL ORDER BY code,language')};}
 if(path==='/settings/templates'&&method==='PUT')return mail.saveTemplate(db,a,data);
 if(path==='/settings/template-approval'&&method==='POST')return mail.approveTemplate(db,a,data);
 if(path==='/settings/outbox'&&method==='GET')return {items:await mail.listOutbox(db,a)};
 if(parts[0]==='settings'&&parts[1]==='outbox'&&parts.length===3&&method==='GET')return mail.outboxDetail(db,config,a,uuid(parts[2]));
 if(path==='/settings/mail-accounts'&&method==='GET')return {items:await mailAccounts.listMailAccounts(db,a)};
 if(path==='/settings/mail-accounts'&&method==='POST')return mailAccounts.saveMailAccount(db,a,config,data);
 if(parts[0]==='settings'&&parts[1]==='mail-accounts'&&parts.length===3&&method==='PUT')return mailAccounts.saveMailAccount(db,a,config,data,parts[2]);
 if(path==='/tasks'&&method==='GET')return {items:await work.tasks(db,a,{mine:url.searchParams.get('mine')==='true',month:url.searchParams.get('month'),search:url.searchParams.get('q')||''})};
 if(path==='/tasks'&&method==='POST')return work.createTask(db,a,data);
 if(parts[0]==='tasks'&&parts.length===2&&method==='GET')return work.taskDetail(db,a,parts[1]);
 if(parts[0]==='tasks'&&parts.length===2&&method==='PUT')return work.updateTask(db,a,parts[1],data,now);
 if(path==='/task-comments'&&method==='POST')return work.commentTask(db,a,data.task_id,data.body);
 if(path==='/task-rules'&&method==='GET'){requirePermission(a,'task_rules','view');return {items:await all(db,'SELECT * FROM task_rules WHERE deleted_at IS NULL ORDER BY code')};}
 if(path==='/task-rules'&&method==='POST')return work.saveRule(db,a,data);
 if(parts[0]==='task-rules'&&parts.length===2&&method==='PUT')return work.saveRule(db,a,data,parts[1]);
 if(path==='/approvals'&&method==='GET')return {items:await work.approvals(db,a)};
 if(path==='/approvals'&&method==='POST'){requirePermission(a,'approvals','create');return work.submitApproval(db,a,{kind:'general',entityType:'general',reason:data.reason,payload:{description:text(data.description||'',4000)},roleId:uuid(data.role_id)},now);}
 if(parts[0]==='approvals'&&parts.length===2&&method==='PUT')return work.decideApproval(db,a,parts[1],data,{exchange_rate:rates.applyRateApproval,customer_company:customer.applyCustomerApproval,customer_membership:customer.applyCustomerApproval},now);
 if(parts[0]==='approvals'&&parts.length===2&&method==='GET'){const allowed=await work.approvals(db,a);const row=allowed.find(x=>x.id===parts[1]);must(row,404,'not_found');return {...row,history:await all(db,'SELECT * FROM approval_steps WHERE approval_id=$1 ORDER BY created_at,id',[row.id])};}
 if(path==='/exchange-rates'&&method==='GET')return {items:await rates.listRates(db,a,now)};
 if(path==='/exchange-rates/preview'&&method==='POST')return rates.previewRate(db,a,data,now);
 if(path==='/exchange-rates/confirm'&&method==='POST')return rates.confirmRate(db,a,data,now);
 if(path==='/scheduler/run'&&method==='POST'){requirePermission(a,'task_rules','edit');const result=await tick(db,config,now);await audit(db,a.id,'scheduler.manual_run','scheduler',id(),null,result);return result;}
 if(path==='/lookups'&&method==='GET'){
  const staffPermission=['tasks','approvals','users','masters','exchange_rates'].some(m=>can(a,m,'view'));must(staffPermission,403,'access_denied');
  return {roles:await all(db,'SELECT id,code,name FROM roles WHERE deleted_at IS NULL ORDER BY name'),users:await all(db,"SELECT id,display_name FROM users WHERE kind='staff' AND state='active' AND deleted_at IS NULL ORDER BY display_name"),warehouses:a.super?await all(db,'SELECT id,name FROM warehouses WHERE active=true AND deleted_at IS NULL'):await all(db,'SELECT id,name FROM warehouses WHERE id=ANY($1::uuid[]) AND active=true AND deleted_at IS NULL',[a.warehouseIds]),currencies:await all(db,'SELECT code,name FROM currencies WHERE active=true AND deleted_at IS NULL ORDER BY code')};
 }
 fail(404,'not_found');
}
