import {id,text,uuid,integer,timestamp,one,all,must,fail,audit,optimistic} from './core.mjs';
import {can,requirePermission,taskScope,validateAssignee,isApprover} from './rbac.mjs';
import {eventTypes,statuses} from './catalog.mjs';
const conditionFields=['service','country','status','ageHours','hoursToETA','daysOverdue','count','warehouseId'];
export function validateRule(data){
  must(typeof data.code==='string'&&/^[a-z0-9][a-z0-9_.-]{0,59}$/.test(data.code),400,'invalid_rule');must(eventTypes.includes(data.trigger_event),400,'invalid_rule');text(data.title_template,200,true);
  must([...data.title_template.matchAll(/\{([^}]+)\}/g)].every(m=>['code','service','country','status','count'].includes(m[1])),400,'invalid_rule');
  must(Array.isArray(data.conditions)&&data.conditions.length<=12,400,'invalid_rule');
  for(const c of data.conditions){must(c&&conditionFields.includes(c.field)&&['eq','ne','gte','lte','in'].includes(c.op),400,'invalid_rule');must(c.op==='in'?Array.isArray(c.value)&&c.value.length<=30:['string','number','boolean'].includes(typeof c.value),400,'invalid_rule');}
  must(['rule','event_user','event_role'].includes(data.owner_source||'rule'),400,'invalid_rule');
  if(data.owner_role_id)uuid(data.owner_role_id);if(data.owner_user_id)uuid(data.owner_user_id);must(data.owner_role_id||data.owner_user_id,400,'invalid_rule');
  integer(data.due_minutes,0,525600);if(data.repeat_minutes!=null)integer(data.repeat_minutes,60,525600);
  must(data.auto_close_event==null||data.auto_close_event===''||eventTypes.includes(data.auto_close_event),400,'invalid_rule');
}
export function matches(conditions,facts){return conditions.every(c=>{const value=facts[c.field];if(value===undefined)return false;switch(c.op){case'eq':return value===c.value;case'ne':return value!==c.value;case'gte':return typeof value==='number'&&typeof c.value==='number'&&value>=c.value;case'lte':return typeof value==='number'&&typeof c.value==='number'&&value<=c.value;case'in':return c.value.includes(value);default:return false;}});}
const titleFor=(source,facts)=>source.replace(/\{(code|service|country|status|count)\}/g,(_,key)=>String(facts[key]??'')).slice(0,200);
export async function saveRule(db,actor,data,recordId=null){requirePermission(actor,'task_rules',recordId?'edit':'create');validateRule(data);const old=recordId?await one(db,'SELECT * FROM task_rules WHERE id=$1',[uuid(recordId)]):null;if(recordId)optimistic(old,data.version);
 const fields=['code','trigger_event','conditions','title_template','owner_source','owner_role_id','owner_user_id','due_minutes','repeat_minutes','suggested','auto_close_event','template_code','active'];
 must(Object.keys(data).every(k=>fields.includes(k)||k==='version'),400,'unknown_field');
 if(data.template_code)must(await one(db,'SELECT id FROM email_templates WHERE code=$1 AND deleted_at IS NULL LIMIT 1',[data.template_code]),400,'invalid_template');
 const values={...data,owner_source:data.owner_source||'rule',owner_role_id:data.owner_role_id||null,owner_user_id:data.owner_user_id||null,repeat_minutes:data.repeat_minutes||null,suggested:!!data.suggested,auto_close_event:data.auto_close_event||null,template_code:data.template_code||null,active:data.active!==false};delete values.version;
 const keys=fields,params=keys.map(k=>k==='conditions'?JSON.stringify(values[k]):values[k]),rid=old?.id||id();
 const row=old?await one(db,`UPDATE task_rules SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')},version=version+1 WHERE id=$${keys.length+1} RETURNING *`,[...params,rid]):await one(db,`INSERT INTO task_rules(id,created_by,${keys.join(',')}) VALUES($1,$2,${keys.map((_,i)=>'$'+(i+3)).join(',')}) RETURNING *`,[rid,actor.id,...params]);
 await audit(db,actor.id,old?'rule.updated':'rule.created','task_rules',rid,old,row);return row;
}
export async function emit(db,event,actorId=null,now=Date.now()){
  must(eventTypes.includes(event.type),400,'invalid_event');text(event.key,240,true);text(event.entityType,60,true);if(event.entityId)uuid(event.entityId);
  const existing=await one(db,'SELECT id FROM workflow_events WHERE event_key=$1',[event.key]);if(existing)return {id:existing.id,created:0};
  const eventId=id();await db.query('INSERT INTO workflow_events(id,event_key,event_type,entity_type,entity_id,warehouse_id,payload,occurred_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[eventId,event.key,event.type,event.entityType,event.entityId||null,event.warehouseId||null,JSON.stringify(event.facts||{}),new Date(now),actorId]);
  const closing=await all(db,`SELECT t.* FROM tasks t JOIN task_rules r ON r.id=t.rule_id WHERE r.auto_close_event=$1 AND t.entity_type=$2 AND t.entity_id=$3 AND t.status IN ('open','in_progress','submitted','suggested') AND t.deleted_at IS NULL`,[event.type,event.entityType,event.entityId||null]);
  for(const task of closing){await db.query("UPDATE tasks SET status='completed',completed_at=$1,version=version+1 WHERE id=$2",[new Date(now),task.id]);await audit(db,actorId,'task.auto_closed','tasks',task.id,{status:task.status},{status:'completed',event_id:eventId});}
  const rules=await all(db,'SELECT * FROM task_rules WHERE trigger_event=$1 AND active=true AND deleted_at IS NULL',[event.type]);let created=0;
  for(const rule of rules){if(!matches(rule.conditions,event.facts||{}))continue;
    const open=event.entityId?await one(db,"SELECT id FROM tasks WHERE rule_id=$1 AND entity_type=$2 AND entity_id=$3 AND status IN ('suggested','open','in_progress','submitted') AND deleted_at IS NULL",[rule.id,event.entityType,event.entityId]):null;if(open)continue;if(rule.repeat_minutes&&event.entityId){const last=await one(db,'SELECT created_at FROM tasks WHERE rule_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY created_at DESC LIMIT 1',[rule.id,event.entityType,event.entityId]);if(last&&+new Date(last.created_at)+rule.repeat_minutes*60000>now)continue;}
    let assignee=rule.owner_user_id,role=rule.owner_role_id;
    if(rule.owner_source==='event_user'&&event.ownerUserId)assignee=uuid(event.ownerUserId);
    if(rule.owner_source==='event_role'&&event.ownerRoleId)role=uuid(event.ownerRoleId);
    if(assignee){const u=await one(db,"SELECT id FROM users WHERE id=$1 AND kind='staff' AND state='active' AND deleted_at IS NULL",[assignee]);if(!u)assignee=null;}
    if(!assignee&&!role)continue;
    const taskId=id(),status=rule.suggested?'suggested':'open';
    await db.query(`INSERT INTO tasks(id,rule_id,event_id,booking_id,approval_id,warehouse_id,title,status,assignee_id,owner_role_id,entity_type,entity_id,due_at,dedupe_key,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,[taskId,rule.id,eventId,event.entityType==='booking'?event.entityId:null,event.entityType==='approval'?event.entityId:null,event.warehouseId||null,titleFor(rule.title_template,event.facts||{}),status,assignee,role,event.entityType,event.entityId||null,new Date(now+rule.due_minutes*60000),rule.id+':'+eventId,actorId]);
    await audit(db,actorId,'task.rule_created','tasks',taskId,null,{rule_id:rule.id,status});created++;
  }
  return {id:eventId,created};
}
export async function tasks(db,actor,{mine=false,month=null,search=''}={}){const scope=taskScope(actor);const values=[...scope.values],clauses=[scope.sql,'deleted_at IS NULL'];
 if(mine){values.push(actor.id);clauses.push('assignee_id=$'+values.length);}
 if(month){must(/^\d{4}-\d{2}$/.test(month));values.push(month+'-01');clauses.push("due_at>=$"+values.length+"::date AND due_at<($"+values.length+"::date + interval '1 month')");}
 if(search){values.push('%'+text(search,100)+'%');clauses.push('title ILIKE $'+values.length);}
 return all(db,'SELECT * FROM tasks WHERE '+clauses.join(' AND ')+' ORDER BY due_at,id LIMIT 200',values);
}
export async function createTask(db,actor,data){requirePermission(actor,'tasks','create');const title=text(data.title,200,true),description=text(data.description||'',4000),warehouse=data.warehouse_id?uuid(data.warehouse_id):null,assignee=data.assignee_id?uuid(data.assignee_id):actor.id;
 const allGrant=actor.super||actor.grants.some(g=>g.module==='tasks'&&g.action==='create'&&g.scope==='all');
 if(!allGrant&&actor.grants.some(g=>g.module==='tasks'&&g.action==='create'&&g.scope==='warehouse'))must(warehouse&&actor.warehouseIds.includes(warehouse),403,'warehouse_access_required');
 await validateAssignee(db,actor,assignee,warehouse);const task=await one(db,`INSERT INTO tasks(id,title,description,status,assignee_id,warehouse_id,due_at,created_by) VALUES($1,$2,$3,'open',$4,$5,$6,$7) RETURNING *`,[id(),title,description,assignee,warehouse,timestamp(data.due_at),actor.id]);await audit(db,actor.id,'task.created','tasks',task.id,null,task);return task;}
const next={suggested:['open','dismissed'],open:['in_progress','submitted','completed','cancelled'],in_progress:['open','submitted','completed','cancelled'],submitted:['open','completed','cancelled'],completed:[],dismissed:[],cancelled:[]};
export async function updateTask(db,actor,taskId,data,now=Date.now()){const old=await one(db,'SELECT * FROM tasks WHERE id=$1 AND deleted_at IS NULL',[uuid(taskId)]);must(old,404,'not_found');requirePermission(actor,'tasks','edit',old);optimistic(old,data.version);
 const status=data.status||old.status;must(status===old.status||next[old.status].includes(status),409,'invalid_transition');
 if(['dismissed','cancelled'].includes(status))text(data.reason||'',1000,true);
 const assignee=data.assignee_id?uuid(data.assignee_id):old.assignee_id;await validateAssignee(db,actor,assignee,old.warehouse_id);
 const due=data.due_at?timestamp(data.due_at):old.due_at;const row=await one(db,'UPDATE tasks SET status=$1,assignee_id=$2,due_at=$3,completed_at=$4,version=version+1 WHERE id=$5 RETURNING *',[status,assignee,due,status==='completed'?new Date(now):null,old.id]);
 await db.query('INSERT INTO task_events(task_id,action,before_data,after_data,reason,created_by) VALUES($1,$2,$3,$4,$5,$6)',[old.id,'updated',JSON.stringify({status:old.status,assignee_id:old.assignee_id,due_at:old.due_at}),JSON.stringify({status,assignee_id:assignee,due_at:due}),text(data.reason||'',1000),actor.id]);await audit(db,actor.id,'task.updated','tasks',old.id,old,row,text(data.reason||'',1000));return row;}
export async function commentTask(db,actor,taskId,body){const task=await one(db,'SELECT * FROM tasks WHERE id=$1 AND deleted_at IS NULL',[uuid(taskId)]);must(task,404,'not_found');requirePermission(actor,'tasks','view',task);const row=await one(db,'INSERT INTO task_comments(task_id,body,created_by) VALUES($1,$2,$3) RETURNING *',[task.id,text(body,4000,true),actor.id]);await audit(db,actor.id,'task.comment','task_comments',row.id,null,{task_id:task.id});return row;}
export async function taskDetail(db,actor,taskId){const task=await one(db,'SELECT * FROM tasks WHERE id=$1 AND deleted_at IS NULL',[uuid(taskId)]);must(task,404,'not_found');requirePermission(actor,'tasks','view',task);return {...task,comments:await all(db,'SELECT * FROM task_comments WHERE task_id=$1 ORDER BY created_at',[task.id]),history:await all(db,'SELECT * FROM task_events WHERE task_id=$1 ORDER BY created_at',[task.id])};}
export async function submitApproval(db,actor,{kind='general',entityType='general',entityId=null,payload={},reason,roleId,warehouseId=null},now=Date.now()){
 const note=text(reason,2000,true);uuid(roleId);must(await one(db,"SELECT rp.id FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=$1 AND p.code='approvals.approve' AND rp.deleted_at IS NULL",[roleId]),400,'invalid_approver');
 const record=id(),reference='AP-'+record.slice(0,8).toUpperCase();
 const row=await one(db,'INSERT INTO approvals(id,reference,kind,entity_type,entity_id,payload,reason,approver_role_id,warehouse_id,created_by,submitted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[record,reference,kind,entityType,entityId,JSON.stringify(payload),note,roleId,warehouseId,actor.id,new Date(now)]);
 await db.query("INSERT INTO approval_steps(approval_id,action,note,revision,created_by) VALUES($1,'submitted',$2,1,$3)",[record,note,actor.id]);await audit(db,actor.id,'approval.submitted','approvals',record,null,{kind,status:'pending',entity_id:entityId});
 await emit(db,{key:'approval:'+record+':1',type:'approval.requested',entityType:'approval',entityId:record,warehouseId,ownerRoleId:roleId,facts:{code:reference}},actor.id,now);return row;
}
export async function approvals(db,actor){requirePermission(actor,'approvals','view');if(actor.super||actor.grants.some(g=>g.module==='approvals'&&g.action==='view'&&g.scope==='all'))return all(db,'SELECT * FROM approvals WHERE deleted_at IS NULL ORDER BY submitted_at DESC LIMIT 200');return all(db,'SELECT * FROM approvals WHERE deleted_at IS NULL AND (created_by=$1 OR approver_user_id=$1 OR approver_role_id=ANY($2::uuid[])) ORDER BY submitted_at DESC LIMIT 200',[actor.id,actor.roles.map(r=>r.id)]);}
export async function decideApproval(db,actor,approvalId,data,effects={},now=Date.now()){
 const old=await one(db,'SELECT * FROM approvals WHERE id=$1 AND deleted_at IS NULL',[uuid(approvalId)]);must(old,404,'not_found');optimistic(old,data.version);
 must(['approved','returned','cancelled','resubmitted'].includes(data.action),400,'invalid_input');const note=text(data.note||'',2000,true);
 let status=data.action;
 if(data.action==='resubmitted'){must(old.status==='returned'&&old.created_by===actor.id,403,'access_denied');status='pending';}
 else if(data.action==='cancelled')must(['pending','returned'].includes(old.status)&&(old.created_by===actor.id||actor.super),403,'access_denied');
 else{must(old.status==='pending',409,'invalid_transition');must(isApprover(actor,old),403,'approval_not_allowed');}
 if(old.kind!=='general'){const effect=effects[old.kind];must(typeof effect==='function',409,'module_not_available');await effect(db,actor,old,status,data,now);}
 const row=await one(db,'UPDATE approvals SET status=$1,version=version+1,decided_at=$2 WHERE id=$3 RETURNING *',[status,status==='pending'?null:new Date(now),old.id]);
 await db.query('INSERT INTO approval_steps(approval_id,action,note,revision,created_by) VALUES($1,$2,$3,$4,$5)',[old.id,data.action,note,row.version,actor.id]);await audit(db,actor.id,'approval.'+data.action,'approvals',old.id,{status:old.status,version:old.version},{status,version:row.version},note);
 await emit(db,{key:'approval:'+old.id+':'+row.version,type:status==='pending'?'approval.requested':'approval.decided',entityType:'approval',entityId:old.id,ownerRoleId:old.approver_role_id,facts:{code:old.reference}},actor.id,now);return row;
}
