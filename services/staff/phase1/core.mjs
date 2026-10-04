import {randomUUID, randomBytes, createHash, createHmac, timingSafeEqual, createCipheriv, createDecipheriv} from 'node:crypto';
export const languages = Object.freeze(['en','ar','ru','fr','ur','hi','zh']);
export const id = () => randomUUID();
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(String(value)).digest('hex');
export const same = (a,b) => typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function fail(status, code, details) { const error = new Error(code); Object.assign(error,{status,code,details}); throw error; }
export const must = (condition, status=400, code='invalid_input') => { if (!condition) fail(status,code); };
export function text(value, max=200, required=false) { must(typeof value==='string' && value.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)); const out=value.trim(); must(!required||out.length>0); return out; }
export function email(value) { const out=text(value,254,true).toLowerCase(); must(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out)); return out; }
export const uuid = value => { must(typeof value==='string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)); return value; };
export const language = value => { must(languages.includes(value)); return value; };
export function integer(value,min=0,max=1000000) { must(Number.isSafeInteger(value)&&value>=min&&value<=max); return value; }
export function dateOnly(value) { must(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)); const d=new Date(value+'T00:00:00Z'); must(Number.isFinite(+d)&&d.toISOString().startsWith(value)); return value; }
export function timestamp(value) { must(typeof value==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value)); const d=new Date(value); must(Number.isFinite(+d)); return d.toISOString(); }
export function decimal(value,scale=4,precision=18) {
  must(typeof value==='string' && new RegExp(`^-?\\d{1,${precision-scale}}(?:\\.\\d{1,${scale}})?$`).test(value),400,'invalid_decimal');
  const neg=value.startsWith('-'), [whole,fraction='']=value.replace(/^-/,'').split('.');
  return (neg?-1n:1n)*(BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0')));
}
export function formatDecimal(value,scale=4) { const sign=value<0n?'-':''; const abs=value<0n?-value:value; const digits=abs.toString().padStart(scale+1,'0'); return sign+digits.slice(0,-scale)+'.'+digits.slice(-scale); }
export function money(value) { const parsed=decimal(value); must(parsed>=0n,400,'invalid_decimal'); return formatDecimal(parsed); }
export function rate(value) { const parsed=decimal(value,8); must(parsed>0n,400,'invalid_decimal'); return formatDecimal(parsed,8); }
export function percentChange(next,previous) { if(!previous)return null; const n=decimal(next,8),p=decimal(previous,8); must(p>0n); return formatDecimal((n-p)*1000000n/p,4); }
export function thresholdExceeded(next,previous,threshold) { if(!previous)return false; const delta=decimal(next,8)-decimal(previous,8),abs=delta<0n?-delta:delta; return abs*1000000n>decimal(previous,8)*decimal(threshold); }
export function readConfig(env=process.env) {
  const mode=env.NODE_ENV||'production', testMode=env.AUTH_TEST_MODE==='true';
  if(testMode&&!['test','development'].includes(mode))throw Error('AUTH_TEST_MODE is forbidden outside test/development');
  const origin=env.APP_ORIGIN||'https://ukr-staff-staging.onrender.com'; const u=new URL(origin);
  must(u.origin===origin && ['http:','https:'].includes(u.protocol),500,'invalid_configuration');
  const loopback=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='https:'&&!(loopback&&['test','development'].includes(mode)))throw Error('HTTPS origin is required');
  let key=env.PORTAL_ENCRYPTION_KEY;
  if(!key&&['test','development'].includes(mode))key=randomBytes(32).toString('hex');
  if(!/^[a-fA-F0-9]{64}$/.test(key||''))throw Error('A 32-byte PORTAL_ENCRYPTION_KEY is required');
  return Object.freeze({mode,testMode,origin,secure:u.protocol==='https:',key:Buffer.from(key,'hex'),ownerEmail:'bayan@ukrshipping.com',
    staffHours:8, customerMinutes:30, otpMinutes:10, resendSeconds:60, otpAttempts:5,
    emailSending:false, from:'no-reply@ukrshipping.com',replyTo:'sales@ukrshipping.com',
    setupTokenHash:env.SETUP_TOKEN_HASH||'',setupExpires:Number(env.SETUP_EXPIRES_AT||0)});
}
export function hmac(config, context, value) { return createHmac('sha256',config.key).update(context+'\0'+String(value)).digest('hex'); }
export function seal(config, context, value) { const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',config.key,iv);cipher.setAAD(Buffer.from(context));const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [1,iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.'); }
export function unseal(config, context, value) { const [v,iv,tag,payload]=String(value).split('.');must(v==='1'&&iv&&tag&&payload,500,'encrypted_data_invalid');try{const cipher=createDecipheriv('aes-256-gcm',config.key,Buffer.from(iv,'base64url'));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,'base64url'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(payload,'base64url')),cipher.final()]).toString('utf8'));}catch{fail(500,'encrypted_data_invalid');} }
export function localClock(now,zone='Asia/Dubai') { const values=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));return {day:`${values.year}-${values.month}-${values.day}`,time:`${values.hour}:${values.minute}`,hour:values.hour}; }
export const previousDay = day => new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
export function zoneInstant(day,clock,zone) {
  let candidate=Date.parse(day+'T'+clock.slice(0,5)+':00Z');
  for(let i=0;i<3;i++){const l=localClock(candidate,zone);candidate+=Date.parse(day+'T'+clock.slice(0,5)+':00Z')-Date.parse(l.day+'T'+l.time+':00Z');}
  const result=localClock(candidate,zone);must(result.day===day&&result.time===clock.slice(0,5),400,'invalid_local_time');return new Date(candidate).toISOString();
}
const sensitive=/password|token|secret|ciphertext|code_hash|credential|body|beneficiary/i;
export function redact(value) { if(Array.isArray(value))return value.map(redact);if(value&&typeof value==='object'&&!(value instanceof Date))return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sensitive.test(k)?'[redacted]':redact(v)]));return value; }
export async function audit(db,actor,action,entityType,entityId,before=null,after=null,reason='') { await db.query('INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,before_data,after_data,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$2)',[id(),actor||null,action,entityType,String(entityId),before==null?null:JSON.stringify(redact(before)),after==null?null:JSON.stringify(redact(after)),reason]); }
export const one = async(db,sql,params=[]) => (await db.query(sql,params)).rows[0]||null;
export const all = async(db,sql,params=[]) => (await db.query(sql,params)).rows;
export const optimistic = (old,version) => must(old&&Number.isSafeInteger(version)&&old.version===version,409,'record_changed');
export const html = value => String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
