import {id,text,email,uuid,integer,decimal,money,language,dateOnly,one,all,must,fail,audit,optimistic} from './core.mjs';
import {requirePermission} from './rbac.mjs';
import {serviceCodes} from './catalog.mjs';
const str=(max=200,required=false)=>v=>text(v,max,required);
const flag=v=>{must(typeof v==='boolean');return v;};
const country=v=>{must(typeof v==='string'&&/^[A-Z]{2}$/.test(v));return v;};
const currency=v=>{must(typeof v==='string'&&/^[A-Z]{3}$/.test(v));return v;};
const nullable=f=>v=>v===null||v===''?null:f(v);
const select=choices=>v=>{must(choices.includes(v));return v;};
const json=(validator=v=>!!v&&typeof v==='object')=>v=>{must(validator(v)&&JSON.stringify(v).length<=16000);return v;};
const code=v=>{must(typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,59}$/.test(v));return v;};
const safeUrl=v=>{if(v==='')return '';const u=new URL(v);must(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password);return u.href;};
export const specs=Object.freeze({
 companies:{label:'Company details',fields:{code,legal_name:str(200,true),licence_number:str(),trn:str(),address:str(1000),country_code:country,phone:str(40),email:v=>v===''?'':email(v),sales_email:v=>v===''?'':email(v),website:safeUrl,base_currency:currency,financial_year_start_month:v=>integer(v,1,12),invoice_prefix:code,pdf_footer:str(2000),bank_accounts:json(v=>Array.isArray(v)&&v.length<=10&&v.every(a=>a&&Object.keys(a).every(k=>['bank','account_name','iban','account_number','swift','currency'].includes(k))&&Object.values(a).every(s=>typeof s==='string'&&s.length<=200))),active:flag},required:['code','legal_name','country_code','base_currency']},
 warehouses:{label:'Warehouses',fields:{code,name:str(200,true),country_code:country,city:str(200,true),address:str(1000),operator_name:str(200),services:json(v=>Array.isArray(v)&&v.every(s=>serviceCodes.includes(s))),tabs:json(v=>Array.isArray(v)&&v.every(s=>typeof s==='string'&&/^[a-z_]{1,40}$/.test(s))),active:flag},required:['code','name','country_code','city']},
 accounts:{label:'Accounts tree',tree:true,fields:{code,name:str(200,true),parent_id:nullable(uuid),account_type:select(['asset','liability','equity','income','expense']),currency:nullable(currency),active:flag},required:['code','name','account_type']},
 products_services:{label:'Products and services tree',tree:true,fields:{code,name:str(200,true),parent_id:nullable(uuid),account_id:nullable(uuid),kind:select(['group','service','charge','product']),unit:str(40),active:flag},required:['code','name','kind']},
 currencies:{label:'Currencies',fields:{code:currency,name:str(100,true),symbol:str(10),minor_units:v=>integer(v,0,4),active:flag},required:['code','name']},
 tax_rates:{label:'Tax rates',fields:{code,country_code:country,region:str(100),label:str(150,true),rate:v=>{const n=decimal(v);must(n>=0n&&n<=1000000n);return money(v);},treatment:select(['standard','zero','exempt']),valid_from:dateOnly,valid_to:nullable(dateOnly),active:flag},required:['code','country_code','label','rate','treatment','valid_from']},
 themes:{label:'Theme presets',permission:'themes',fields:{code,name:str(100,true),tokens:json(v=>v&&!Array.isArray(v)&&['background','surface','text','muted','accent','border'].every(k=>/^#[a-fA-F0-9]{6}$/.test(v[k]||''))&&Object.keys(v).length===6),active:flag},required:['code','name','tokens']},
 exchange_rate_rules:{label:'Exchange rate rules',fields:{code,base_currency:currency,quote_currency:currency,rate_type:str(80,true),timezone:v=>{text(v,80,true);try{new Intl.DateTimeFormat('en',{timeZone:v});return v;}catch{fail(400,'invalid_timezone');}},due_time:v=>{must(/^([01]\d|2[0-3]):[0-5]\d$/.test(v));return v;},cutoff_time:v=>{must(/^([01]\d|2[0-3]):[0-5]\d$/.test(v));return v;},threshold_percent:v=>{const n=decimal(v);must(n>=0n&&n<=1000000n);return money(v);},fee_rules:json(v=>Array.isArray(v)&&v.length<=20&&v.every(f=>{try{return f&&['min','max','fee','currency'].every(k=>Object.hasOwn(f,k))&&decimal(f.min)>=0n&&(f.max===null||decimal(f.max)>decimal(f.min))&&decimal(f.fee)>=0n&&/^[A-Z]{3}$/.test(f.currency);}catch{return false;}})),approver_role_id:uuid,active:flag},required:['code','base_currency','quote_currency','rate_type','approver_role_id']}
});
export function describeMasters(){return Object.entries(specs).map(([key,s])=>({key,label:s.label,tree:!!s.tree,fields:Object.keys(s.fields),required:s.required}));}
export async function listMaster(db,actor,name){const s=specs[name];must(s,404,'not_found');requirePermission(actor,s.permission||'masters','view');return all(db,`SELECT * FROM ${name} WHERE deleted_at IS NULL ORDER BY ${s.fields.code?'code':'created_at'} LIMIT 1000`);}
async function treeCheck(db,name,data,recordId){let parent=data.parent_id,seen=new Set([recordId]);for(let depth=0;parent;depth++){must(depth<100&&!seen.has(parent),400,'tree_cycle');seen.add(parent);const row=await one(db,`SELECT * FROM ${name} WHERE id=$1 AND deleted_at IS NULL`,[parent]);must(row,400,'invalid_parent');if(name==='accounts'&&data.account_type)must(row.account_type===data.account_type,400,'account_type_mismatch');parent=row.parent_id;}}
export async function saveMaster(db,actor,name,data,recordId=null){
 const s=specs[name];must(s,404,'not_found');requirePermission(actor,s.permission||'masters',recordId?'edit':'create');
 const old=recordId?await one(db,`SELECT * FROM ${name} WHERE id=$1 AND deleted_at IS NULL`,[uuid(recordId)]):null;
 if(recordId)optimistic(old,data.version);
 const values={};for(const [key,value]of Object.entries(data)){if(key==='version')continue;must(Object.hasOwn(s.fields,key),400,'unknown_field');values[key]=s.fields[key](value);}
 for(const required of s.required)must(Object.hasOwn(values,required)||old&&old[required]!=null,400,'required_field');
 if(old&&values.code&&values.code!==old.code)fail(400,'code_is_immutable');
 const combined={...old,...values},record=old?.id||id();
 if(s.tree)await treeCheck(db,name,combined,record);
 if(name==='tax_rates')must(!combined.valid_to||combined.valid_to>=combined.valid_from,400,'invalid_validity');
 if(name==='exchange_rate_rules'){
   must(combined.base_currency!==combined.quote_currency,400,'invalid_currency_pair');must((combined.cutoff_time||'12:00')>(combined.due_time||'09:00'),400,'invalid_validity');
   const permitted=await one(db,"SELECT rp.id FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=$1 AND p.code='approvals.approve' AND rp.deleted_at IS NULL",[combined.approver_role_id]);must(permitted,400,'invalid_approver');
 }
 const keys=Object.keys(values),params=keys.map(k=>typeof values[k]==='object'&&values[k]!==null?JSON.stringify(values[k]):values[k]);must(keys.length>0);
 let row;if(old){row=await one(db,`UPDATE ${name} SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')},version=version+1 WHERE id=$${params.length+1} RETURNING *`,[...params,record]);}
 else row=await one(db,`INSERT INTO ${name}(id,created_by,${keys.join(',')}) VALUES($1,$2,${keys.map((_,i)=>'$'+(i+3)).join(',')}) RETURNING *`,[record,actor.id,...params]);
 await audit(db,actor.id,old?'master.updated':'master.created',name,record,old,row);return row;
}
export async function deleteMaster(db,actor,name,recordId,version){const s=specs[name];must(s,404,'not_found');requirePermission(actor,s.permission||'masters','delete');const old=await one(db,`SELECT * FROM ${name} WHERE id=$1 AND deleted_at IS NULL`,[uuid(recordId)]);optimistic(old,version);
 if(s.tree)must(!await one(db,`SELECT id FROM ${name} WHERE parent_id=$1 AND deleted_at IS NULL LIMIT 1`,[recordId]),409,'record_in_use');
 if(name==='companies'&&old.code==='UKR-UAE')fail(409,'record_in_use');if(name==='themes')must(!await one(db,'SELECT id FROM user_preferences WHERE theme_id=$1 AND deleted_at IS NULL LIMIT 1',[recordId]),409,'record_in_use');
 if(name==='currencies')must(!await one(db,'SELECT id FROM companies WHERE base_currency=$1 AND deleted_at IS NULL LIMIT 1',[old.code]),409,'record_in_use');
 await db.query(`UPDATE ${name} SET deleted_at=now(),version=version+1 WHERE id=$1`,[recordId]);await audit(db,actor.id,'master.deleted',name,recordId,old,{deleted:true});return {ok:true};}
export async function preference(db,actor){return one(db,'SELECT p.*,t.code AS theme_code,t.tokens FROM user_preferences p JOIN themes t ON t.id=p.theme_id WHERE p.user_id=$1 AND p.deleted_at IS NULL',[actor.id]);}
export async function savePreference(db,actor,data){const old=await preference(db,actor);optimistic(old,data.version);must(Object.keys(data).every(k=>['version','language','theme_id','accent','font_size','density'].includes(k)),400,'unknown_field');
 const locale=language(data.language),theme=await one(db,'SELECT id FROM themes WHERE id=$1 AND active=true AND deleted_at IS NULL',[uuid(data.theme_id)]);must(theme,400,'invalid_theme');
 const accent=data.accent||null;must(accent===null||/^#[a-fA-F0-9]{6}$/.test(accent),400,'invalid_theme');integer(data.font_size,12,24);must(['compact','comfortable'].includes(data.density));
 await db.query('UPDATE user_preferences SET language=$1,theme_id=$2,accent=$3,font_size=$4,density=$5,version=version+1 WHERE user_id=$6',[locale,theme.id,accent,data.font_size,data.density,actor.id]);await db.query('UPDATE users SET preferred_language=$1 WHERE id=$2',[locale,actor.id]);
 if(actor.kind==='customer')await db.query('UPDATE booking_lab_customers SET language=$1 WHERE id=(SELECT legacy_customer_id FROM users WHERE id=$2)',[locale,actor.id]);
 const row=await preference(db,actor);await audit(db,actor.id,'preferences.updated','user_preferences',row.id,old,row);return row;}
