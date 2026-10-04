import {id,uuid,rate,one,all,must,audit,localClock,previousDay,zoneInstant,percentChange,thresholdExceeded,optimistic} from './core.mjs';
import {ratePermission} from './rbac.mjs';
import {submitApproval,emit} from './workflow.mjs';
const dayOf=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
export async function usableRate(db,rule,now=Date.now()){
 const clock=localClock(now,rule.timezone);const today=await one(db,"SELECT * FROM exchange_rates WHERE rule_id=$1 AND rate_date=$2 AND status='active' AND valid_until>$3 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",[rule.id,clock.day,new Date(now)]);
 if(today)return {available:true,grace:false,rate:today};
 if(clock.time<rule.cutoff_time.slice(0,5)){const previous=await one(db,"SELECT * FROM exchange_rates WHERE rule_id=$1 AND rate_date=$2 AND status='active' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",[rule.id,previousDay(clock.day)]);if(previous)return {available:true,grace:true,usable_until:zoneInstant(clock.day,rule.cutoff_time,rule.timezone),rate:previous};}
 return {available:false,grace:false,reason:'rate_unavailable'};
}
export async function listRates(db,actor,now=Date.now()){
 const rules=await all(db,'SELECT * FROM exchange_rate_rules WHERE deleted_at IS NULL AND active=true ORDER BY code');const result=[];
 for(const rule of rules){try{ratePermission(actor,'view',rule);}catch(e){if(e.status===403)continue;throw e;}result.push({...rule,current:await usableRate(db,rule,now),history:await all(db,'SELECT * FROM exchange_rates WHERE rule_id=$1 AND deleted_at IS NULL ORDER BY rate_date DESC,created_at DESC LIMIT 30',[rule.id])});}return result;
}
async function baseline(db,rule,day){return one(db,"SELECT * FROM exchange_rates WHERE rule_id=$1 AND rate_date<=$2 AND status='active' AND deleted_at IS NULL ORDER BY rate_date DESC,created_at DESC LIMIT 1",[rule.id,day]);}
export async function previewRate(db,actor,data,now=Date.now()){
 const rule=await one(db,'SELECT * FROM exchange_rate_rules WHERE id=$1 AND active=true AND deleted_at IS NULL',[uuid(data.rule_id)]);must(rule,404,'not_found');ratePermission(actor,'create',rule);
 const proposed=rate(data.rate),day=localClock(now,rule.timezone).day,previous=await baseline(db,rule,day);
 const saved=await one(db,'INSERT INTO rate_confirmations(rule_id,proposed_rate,rate_date,previous_id,previous_rate,rule_version,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[rule.id,proposed,day,previous?.id||null,previous?.rate||null,rule.version,new Date(now+900000),actor.id]);
 await audit(db,actor.id,'exchange_rate.preview','rate_confirmations',saved.id,null,{proposed_rate:proposed,previous_rate:previous?.rate||null});
 return {...saved,previous_date:previous?dayOf(previous.rate_date):null,change_percent:percentChange(proposed,previous?.rate),threshold_percent:rule.threshold_percent,requires_approval:thresholdExceeded(proposed,previous?.rate,rule.threshold_percent)};
}
export async function confirmRate(db,actor,data,now=Date.now()){
 must(data.confirmed===true,400,'confirmation_required');const confirmation=await one(db,'SELECT * FROM rate_confirmations WHERE id=$1 AND created_by=$2',[uuid(data.confirmation_id),actor.id]);must(confirmation&&!confirmation.consumed_at&&+new Date(confirmation.expires_at)>now,409,'rate_preview_expired');
 const rule=await one(db,'SELECT * FROM exchange_rate_rules WHERE id=$1 AND active=true AND deleted_at IS NULL',[confirmation.rule_id]);must(rule&&rule.version===confirmation.rule_version,409,'rate_changed');ratePermission(actor,'create',rule);
 const day=localClock(now,rule.timezone).day;must(day===dayOf(confirmation.rate_date),409,'rate_changed');const previous=await baseline(db,rule,day);must((previous?.id||null)===confirmation.previous_id,409,'rate_changed');
 const needsApproval=thresholdExceeded(confirmation.proposed_rate,previous?.rate,rule.threshold_percent),recordId=id(),validUntil=zoneInstant(new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10),rule.due_time,rule.timezone);
 if(!needsApproval)await db.query("UPDATE exchange_rates SET status='superseded',version=version+1 WHERE rule_id=$1 AND rate_date=$2 AND status='active'",[rule.id,day]);
 const row=await one(db,"INSERT INTO exchange_rates(id,rule_id,confirmation_id,rate,rate_date,valid_until,status,previous_id,approved_by,approved_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",[recordId,rule.id,confirmation.id,confirmation.proposed_rate,day,validUntil,needsApproval?'pending':'active',previous?.id||null,needsApproval?null:actor.id,needsApproval?null:new Date(now),actor.id]);
 await db.query('UPDATE rate_confirmations SET consumed_at=$1 WHERE id=$2',[new Date(now),confirmation.id]);
 let approval=null;if(needsApproval)approval=await submitApproval(db,actor,{kind:'exchange_rate',entityType:'exchange_rate',entityId:row.id,reason:'Exchange rate change exceeds the configured threshold.',roleId:rule.approver_role_id,payload:{rule_id:rule.id,previous_rate:previous?.rate||null,proposed_rate:row.rate,confirmation_id:confirmation.id,rule_version:rule.version}},now);
 await audit(db,actor.id,'exchange_rate.'+(needsApproval?'submitted':'activated'),'exchange_rates',row.id,null,row);
 if(!needsApproval)await closeRateTasks(db,rule,actor.id,now);return {rate:row,approval};
}
async function closeRateTasks(db,rule,actor,now){await db.query("UPDATE tasks SET status='completed',completed_at=$2,version=version+1 WHERE entity_type='exchange_rate_rule' AND entity_id=$1 AND status IN ('open','in_progress','suggested')",[rule.id,new Date(now)]);await audit(db,actor,'exchange_rate.reminders_closed','exchange_rate_rules',rule.id);}
export async function applyRateApproval(db,actor,approval,status,data,now){const row=await one(db,'SELECT * FROM exchange_rates WHERE id=$1',[approval.entity_id]);must(row,404,'not_found');const rule=await one(db,'SELECT * FROM exchange_rate_rules WHERE id=$1 AND active=true AND deleted_at IS NULL',[row.rule_id]);must(rule,409,'rate_changed');
 if(status==='approved'){must(row.status==='pending'&&approval.payload.rule_version===rule.version&&dayOf(row.rate_date)===localClock(now,rule.timezone).day&&+new Date(row.valid_until)>now,409,'rate_changed');const previous=await baseline(db,rule,dayOf(row.rate_date));must((previous?.id||null)===row.previous_id,409,'rate_changed');await db.query("UPDATE exchange_rates SET status='superseded',version=version+1 WHERE rule_id=$1 AND rate_date=$2 AND status='active'",[row.rule_id,row.rate_date]);await db.query("UPDATE exchange_rates SET status='active',approved_by=$1,approved_at=$2,version=version+1 WHERE id=$3",[actor.id,new Date(now),row.id]);await closeRateTasks(db,rule,actor.id,now);}
 else if(status==='pending'){must(row.status==='returned'&&dayOf(row.rate_date)===localClock(now,rule.timezone).day,409,'rate_changed');await db.query("UPDATE exchange_rates SET status='pending',version=version+1 WHERE id=$1",[row.id]);}
 else await db.query("UPDATE exchange_rates SET status='returned',version=version+1 WHERE id=$1 AND status='pending'",[row.id]);
 await audit(db,actor.id,'exchange_rate.approval_effect','exchange_rates',row.id,row,{status});
}
