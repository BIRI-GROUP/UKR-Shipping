import {one,all,id,must,audit,localClock} from './core.mjs';
import {enqueue} from './mail.mjs';
import {emit} from './workflow.mjs';
export async function tick(db,config,now=Date.now()){
 const bucket=new Date(Math.floor(now/60000)*60000).toISOString();let count=0;
 const rules=await all(db,'SELECT * FROM exchange_rate_rules WHERE active=true AND deleted_at IS NULL');
 for(const rule of rules){const clock=localClock(now,rule.timezone);if(clock.time<rule.due_time.slice(0,5))continue;
  if(await one(db,"SELECT id FROM exchange_rates WHERE rule_id=$1 AND rate_date=$2 AND status='active' AND deleted_at IS NULL",[rule.id,clock.day]))continue;
  const owners=await all(db,"SELECT DISTINCT u.id,u.email,u.preferred_language FROM users u JOIN staff_users s ON s.id=u.staff_user_id JOIN user_currencies uc ON uc.user_id=u.id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.kind='staff' AND u.state='active' AND u.deleted_at IS NULL AND s.active=1 AND uc.deleted_at IS NULL AND uc.currency=$1 AND ur.deleted_at IS NULL AND r.code='currency_rate_user'",[rule.base_currency]);
  for(const owner of owners){const key='fx:'+rule.id+':'+clock.day+':'+clock.hour+':'+owner.id;
   const existing=await one(db,'SELECT id FROM email_outbox WHERE dedupe_key=$1',[key]);if(existing)continue;
   await enqueue(db,config,{code:'currency_rate_reminder',to:owner.email,locale:owner.preferred_language,variables:{pair:rule.base_currency+'/'+rule.quote_currency,rate_type:rule.rate_type,rate_date:clock.day,due_time:rule.due_time.slice(0,5),cutoff_time:rule.cutoff_time.slice(0,5),timezone:rule.timezone},dedupeKey:key});
   await emit(db,{key,type:'currency.rate_missing',entityType:'exchange_rate_rule',entityId:rule.id,ownerUserId:owner.id,facts:{code:rule.code,ageHours:0}},null,now);count++;
  }
 }
 const pending=await all(db,"SELECT * FROM approvals WHERE status='pending' AND submitted_at<=$1 AND deleted_at IS NULL",[new Date(now-86400000)]);
 for(const approval of pending)await emit(db,{key:'approval-wait:'+approval.id+':'+new Date(now).toISOString().slice(0,10),type:'approval.waiting',entityType:'approval',entityId:approval.id,ownerRoleId:approval.approver_role_id,facts:{code:approval.reference,ageHours:Math.floor((now-+new Date(approval.submitted_at))/3600000)}},null,now);
 const stale=await all(db,"SELECT b.*,s.code AS service FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.status IN ('in_transit','on_hold') AND b.updated_at<=$1 AND b.deleted_at IS NULL",[new Date(now-172800000)]);
 for(const booking of stale)await emit(db,{key:'stale:'+booking.id+':'+new Date(now).toISOString().slice(0,10),type:'shipment.status_stale',entityType:'booking',entityId:booking.id,ownerUserId:booking.assignee_id,facts:{code:booking.code,service:booking.service,status:booking.status,ageHours:Math.floor((now-+new Date(booking.updated_at))/3600000)}},null,now);
 const eta=await all(db,"SELECT b.*,s.code AS service FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.eta BETWEEN $1 AND $2 AND b.status NOT IN ('delivered','cancelled','declined') AND b.deleted_at IS NULL",[new Date(now),new Date(now+604800000)]);
 for(const booking of eta)await emit(db,{key:'eta:'+booking.id+':'+booking.eta.toISOString(),type:'shipment.eta_soon',entityType:'booking',entityId:booking.id,ownerUserId:booking.assignee_id,facts:{code:booking.code,service:booking.service,hoursToETA:Math.ceil((+booking.eta-now)/3600000)}},null,now);
 const invoices=await all(db,"SELECT * FROM invoices WHERE status='issued' AND due_date<$1 AND deleted_at IS NULL",[new Date(now)]);
 for(const invoice of invoices)await emit(db,{key:'overdue:'+invoice.id+':'+new Date(now).toISOString().slice(0,10),type:'invoice.overdue',entityType:'invoice',entityId:invoice.id,facts:{code:invoice.code,ageHours:Math.floor((now-+new Date(invoice.due_date))/3600000)}},null,now);
 await db.query("INSERT INTO scheduler_runs(job_key,bucket,status,completed_at) VALUES('rules',$1,'completed',$2) ON CONFLICT(job_key,bucket) DO UPDATE SET completed_at=EXCLUDED.completed_at",[bucket,new Date(now)]);
 return {queuedNotifications:count,emailsSent:0,pendingApprovals:pending.length};
}
