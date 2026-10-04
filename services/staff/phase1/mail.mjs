import {id,email,language,languages,html,text,must,fail,one,all,seal,unseal,audit,optimistic} from './core.mjs';
import {requirePermission} from './rbac.mjs';
export const templateVariables=Object.freeze(['otp','booking_code','customer_name','service','origin','destination','warehouse_address','pieces','document_url','message','reason','action','status','eta','invoice_code','amount','currency','due_date','recipient_name','feedback_url','portal_url','pair','rate_type','rate_date','due_time','cutoff_time','timezone','activation_url']);
export function compileTemplate(source,variables){
  text(source,20000);must(Array.isArray(variables)&&variables.every(v=>templateVariables.includes(v)),400,'invalid_template');
  const found=[...source.matchAll(/\{\{([a-z_]+)\}\}/g)].map(m=>m[1]);must(found.every(v=>variables.includes(v)),400,'invalid_template');
  must(!source.replace(/\{\{[a-z_]+\}\}/g,'').includes('{{'),400,'invalid_template');
  return values=>source.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>{must(Object.hasOwn(values,key)&&['string','number'].includes(typeof values[key]),400,'missing_template_variable');const v=String(values[key]);must(v.length<=10000,400,'invalid_template');return v;});
}
export async function renderMail(db,config,code,preferred,variables,{originLanguage=null,translatedVariables={}}={}){
  language(preferred);if(originLanguage)language(originLanguage);
  const selected=[...new Set([preferred,'en',...(['booking_submitted','booking_accepted'].includes(code)&&originLanguage?[originLanguage]:[])])];
  const records=await all(db,'SELECT * FROM email_templates WHERE code=$1 AND deleted_at IS NULL',[code]);
  const parts=[];for(const locale of selected){const template=records.find(t=>t.language===locale);if(!template)fail(409,'missing_template_language');
    const values={...variables,...translatedVariables[locale]};const body=compileTemplate(template.body,template.variables)(values);
    const subject=compileTemplate(template.subject,template.variables)(values);must(!/[\r\n]/.test(subject),400,'invalid_template');
    parts.push({locale,subject,body,approved:template.approved,templateId:template.id,version:template.version});}
  return {from:config.from,replyTo:config.replyTo,subject:parts[0].subject,languages:selected,parts,
    text:parts.map(p=>p.body).join('\n\n----------------\n\n'),
    html:'<!doctype html><html><body><img src="'+html(config.origin)+'/logo.svg" alt="UKR SEA SHIPPING CO LLC" width="180">'+parts.map(p=>'<section lang="'+p.locale+'" dir="'+(['ar','ur'].includes(p.locale)?'rtl':'ltr')+'"><h2>'+html(p.subject)+'</h2><p>'+html(p.body).replaceAll('\n','<br>')+'</p></section>').join('<hr>')+'</body></html>'};
}
export async function enqueue(db,config,{code,to,locale='en',variables={},originLanguage=null,translatedVariables={},dedupeKey,actorId=null,sensitive=false,expiresAt=null}){
  const recipient=email(to),previous=await one(db,'SELECT id,recipient,template_code FROM email_outbox WHERE dedupe_key=$1',[dedupeKey]);
  if(previous){must(previous.recipient===recipient&&previous.template_code===code,409,'duplicate_conflict');return previous.id;}
  const message=await renderMail(db,config,code,locale,variables,{originLanguage,translatedVariables}),outboxId=id();
  await db.query(`INSERT INTO email_outbox(id,template_id,template_code,recipient,subject,body_ciphertext,language,languages,status,sensitive,test_mode,dedupe_key,expires_at,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'held',$9,$10,$11,$12,$13)`,[outboxId,message.parts[0].templateId,code,recipient,message.subject,seal(config,'email:'+outboxId,message),locale,JSON.stringify(message.languages),sensitive,config.testMode,dedupeKey,expiresAt,actorId]);
  await audit(db,actorId,'email.queued','email_outbox',outboxId,null,{template:code,status:'held',languages:message.languages});return outboxId;
}
export async function listOutbox(db,actor){requirePermission(actor,'outbox','view');return all(db,'SELECT id,template_code,recipient,subject,language,languages,status,sensitive,test_mode,created_at,expires_at FROM email_outbox WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100');}
export async function outboxDetail(db,config,actor,outboxId){requirePermission(actor,'outbox','view');const row=await one(db,'SELECT * FROM email_outbox WHERE id=$1 AND deleted_at IS NULL',[outboxId]);must(row,404,'not_found');const safe={id:row.id,recipient:row.recipient,subject:row.subject,status:row.status,sensitive:row.sensitive,test_mode:row.test_mode};
  if(row.sensitive&&!config.testMode)return {...safe,text:'Authentication content is not available in the outbox viewer.'};
  return {...safe,...unseal(config,'email:'+row.id,row.body_ciphertext)};
}
export async function saveTemplate(db,actor,data){requirePermission(actor,'templates','edit');const old=await one(db,'SELECT * FROM email_templates WHERE id=$1 AND deleted_at IS NULL',[data.id]);optimistic(old,data.version);
  const subject=text(data.subject,300,true),body=text(data.body,20000,true);must(!/[\r\n]/.test(subject),400,'invalid_template');
  compileTemplate(subject,old.variables);compileTemplate(body,old.variables);
  const row=await one(db,'UPDATE email_templates SET subject=$1,body=$2,approved=false,version=version+1 WHERE id=$3 RETURNING *',[subject,body,old.id]);
  await audit(db,actor.id,'template.updated','email_templates',row.id,{version:old.version,approved:old.approved},{version:row.version,approved:false});return row;
}
export async function approveTemplate(db,actor,data){requirePermission(actor,'templates','approve');const old=await one(db,'SELECT * FROM email_templates WHERE id=$1',[data.id]);optimistic(old,data.version);const row=await one(db,'UPDATE email_templates SET approved=true,version=version+1 WHERE id=$1 RETURNING *',[old.id]);await audit(db,actor.id,'template.approved','email_templates',old.id,{approved:old.approved},{approved:true});return row;}
export const disabledSender=Object.freeze({name:'disabled',async send(){fail(503,'email_delivery_disabled');}});
