import {randomInt} from 'node:crypto';
import {id,token,digest,hmac,same,seal,unseal,email,language,must,fail,one,audit} from './core.mjs';
import {actorFor} from './rbac.mjs';
import {enqueue} from './mail.mjs';
export async function consumeLimit(db,key,limit,milliseconds,now){const row=await one(db,'SELECT * FROM auth_limits WHERE key=$1',[key]);if(row&&+new Date(row.window_end)>now){await db.query('UPDATE auth_limits SET hits=LEAST(hits+1,$2) WHERE key=$1',[key,limit+1]);return row.hits<limit;}await db.query('INSERT INTO auth_limits(key,hits,window_end) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=1,window_end=EXCLUDED.window_end',[key,new Date(now+milliseconds)]);return true;}
export async function syncStaff(db,legacy){
  let user=await one(db,'SELECT * FROM users WHERE email=$1',[legacy.email.toLowerCase()]);
  if(user&&user.kind!=='staff')fail(409,'identity_conflict');
  if(!user){user=await one(db,`INSERT INTO users(email,display_name,kind,state,staff_user_id) VALUES($1,$2,'staff',$3,$4) RETURNING *`,[legacy.email.toLowerCase(),legacy.name,legacy.active?'active':'disabled',legacy.id]);
    await db.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2 ON CONFLICT(user_id,role_id) DO NOTHING',[user.id,legacy.role]);
  }else if(!user.staff_user_id){user=await one(db,'UPDATE users SET staff_user_id=$1,state=$2,display_name=$3,version=version+1 WHERE id=$4 RETURNING *',[legacy.id,legacy.active?'active':'disabled',legacy.name,user.id]);}
  await db.query("INSERT INTO user_preferences(user_id,theme_id,language) SELECT $1,id,$2 FROM themes WHERE code='ukr-blue' ON CONFLICT(user_id) DO NOTHING",[user.id,user.preferred_language]);return user;
}
export async function createAuth({store,config,passwords,clock=Date.now}){
  must(store?.tx&&passwords?.verifyPassword&&passwords?.hashPassword,500,'invalid_configuration');
  const dummy=await passwords.hashPassword(token());
  async function begin(kind,data,ip='unknown'){
    must(['staff','customer'].includes(kind));const address=email(data.email),locale=language(data.language||'en'),now=clock();
    const permitted=await store.tx(async db=>{
      const allowed=await Promise.all([consumeLimit(db,'all:begin',500,900000,now),consumeLimit(db,hmac(config,'begin:email',address),6,900000,now),consumeLimit(db,hmac(config,'begin:ip',ip),200,900000,now)]);return allowed.every(Boolean);
    });if(!permitted)fail(429,'too_many_requests');
    let legacy=null,credentialOK=false;
    if(kind==='staff'){legacy=await one(store,'SELECT * FROM staff_users WHERE email=$1',[address]);credentialOK=await passwords.verifyPassword(data.password,legacy?.password_hash||dummy);}
    const raw=token(),challengeId=id(),code=config.testMode?'1234':String(randomInt(0,1000000)).padStart(6,'0');
    const result=await store.tx(async db=>{
      const previous=await one(db,'SELECT resend_after FROM otp_codes WHERE email=$1 AND kind=$2 ORDER BY created_at DESC LIMIT 1',[address,kind]);
      if(previous&&+new Date(previous.resend_after)>now)return {error:'resend_wait'};
      let user=await one(db,'SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL',[address]);
      if(kind==='staff'&&credentialOK&&legacy){const current=await one(db,'SELECT * FROM staff_users WHERE id=$1',[legacy.id]);if(current?.active&&current.password_hash===legacy.password_hash)user=await syncStaff(db,current);else credentialOK=false;}
      const eligible=kind==='staff'?!!(credentialOK&&legacy?.active&&user?.kind==='staff'&&user.state==='active'):(!user||(user.kind==='customer'&&['active','pending'].includes(user.state)));
      await db.query('UPDATE otp_codes SET invalidated_at=$1 WHERE email=$2 AND kind=$3 AND consumed_at IS NULL AND invalidated_at IS NULL',[new Date(now),address,kind]);
      await db.query(`INSERT INTO otp_codes(id,challenge_hash,email,kind,user_id,code_hash,auth_version,credential_hash,eligible,expires_at,resend_after,test_mode,language)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[challengeId,digest(raw),address,kind,user?.id||null,hmac(config,'otp:'+challengeId,code),user?.auth_version||null,kind==='staff'&&legacy?digest(legacy.password_hash):null,eligible,new Date(now+600000),new Date(now+60000),config.testMode,locale]);
      if(eligible)await enqueue(db,config,{code:'auth_otp',to:address,locale,variables:{otp:code},sensitive:true,dedupeKey:'otp:'+challengeId,actorId:user?.id||null,expiresAt:new Date(now+600000)});
      await audit(db,null,'auth.challenge','otp_codes',challengeId,null,{kind});return {raw,cooldownSeconds:60};
    });if(result.error)fail(429,result.error);return result;
  }
  async function resend(raw,ip='unknown'){
    const old=await one(store,'SELECT * FROM otp_codes WHERE challenge_hash=$1',[digest(raw||'')]);if(!old||old.consumed_at||old.invalidated_at||+new Date(old.expires_at)<=clock())fail(400,'invalid_code');
    const now=clock(),fresh=token(),code=config.testMode?'1234':String(randomInt(0,1000000)).padStart(6,'0');
    const result=await store.tx(async db=>{
      const current=await one(db,'SELECT * FROM otp_codes WHERE id=$1',[old.id]);
      if(!current||current.consumed_at||current.invalidated_at||+new Date(current.expires_at)<=now)return {error:'invalid_code'};
      if(+new Date(current.resend_after)>now)return {error:'resend_wait'};
      const limits=await Promise.all([consumeLimit(db,hmac(config,'begin:email',old.email),6,900000,now),consumeLimit(db,hmac(config,'begin:ip',ip),200,900000,now)]);if(!limits.every(Boolean))return {error:'too_many_requests'};
      const nextId=id();await db.query('UPDATE otp_codes SET invalidated_at=$1 WHERE email=$2 AND kind=$3 AND consumed_at IS NULL AND invalidated_at IS NULL',[new Date(now),old.email,old.kind]);
      await db.query(`INSERT INTO otp_codes(id,challenge_hash,email,kind,user_id,code_hash,auth_version,credential_hash,eligible,expires_at,resend_after,test_mode,language)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[nextId,digest(fresh),old.email,old.kind,old.user_id,hmac(config,'otp:'+nextId,code),old.auth_version,old.credential_hash,old.eligible,new Date(now+600000),new Date(now+60000),config.testMode,old.language]);
      if(old.eligible){const u=old.user_id?await one(db,'SELECT preferred_language FROM users WHERE id=$1',[old.user_id]):null;await enqueue(db,config,{code:'auth_otp',to:old.email,locale:old.language||u?.preferred_language||'en',variables:{otp:code},sensitive:true,dedupeKey:'otp:'+nextId,expiresAt:new Date(now+600000),actorId:old.user_id});}
      return {raw:fresh,cooldownSeconds:60};
    });if(result.error)fail(result.error==='invalid_code'?400:429,result.error);return result;
  }
  async function verify(raw,code){
    const now=clock();const result=await store.tx(async db=>{
      const allowed=await consumeLimit(db,'all:verify',1000,900000,now);if(!allowed)return {error:'too_many_requests'};
      const challenge=await one(db,'SELECT * FROM otp_codes WHERE challenge_hash=$1',[digest(raw||'')]);
      if(!challenge||challenge.consumed_at||challenge.invalidated_at||+new Date(challenge.expires_at)<=now||challenge.attempts>=5)return {error:'invalid_code'};
      await db.query('UPDATE otp_codes SET attempts=attempts+1 WHERE id=$1',[challenge.id]);
      const valid=typeof code==='string'&&(config.testMode?/^1234$/:/^\d{6}$/).test(code)&&same(hmac(config,'otp:'+challenge.id,code),challenge.code_hash)&&challenge.eligible&&challenge.test_mode===config.testMode;
      if(!valid){await audit(db,null,'auth.code_rejected','otp_codes',challenge.id);return {error:'invalid_code'};}
      let user=await one(db,'SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL',[challenge.email]);
      if(challenge.kind==='staff'){
        const legacy=user?.staff_user_id?await one(db,'SELECT * FROM staff_users WHERE id=$1',[user.staff_user_id]):null;
        if(!user||user.kind!=='staff'||user.state!=='active'||user.auth_version!==challenge.auth_version||!legacy?.active||digest(legacy.password_hash)!==challenge.credential_hash)return {error:'invalid_code'};
      }else{
        if(user&&(user.kind!=='customer'||!['pending','active'].includes(user.state)))return {error:'invalid_code'};
        if(!user){const legacyId=id();await db.query('INSERT INTO booking_lab_customers(id,name,email,email_verified,active,language,created_at) VALUES($1,$2,$3,1,1,$4,$5)',[legacyId,'',challenge.email,challenge.language,now]);user=await one(db,"INSERT INTO users(email,kind,state,legacy_customer_id,preferred_language) VALUES($1,'customer','active',$2,$3) RETURNING *",[challenge.email,legacyId,challenge.language]);await db.query("INSERT INTO customers(user_id,status,created_by) VALUES($1,'pending',$1)",[user.id]);}
        else user=await one(db,"UPDATE users SET state='active' WHERE id=$1 RETURNING *",[user.id]);
        if(user.legacy_customer_id)await db.query('UPDATE booking_lab_customers SET email_verified=1 WHERE id=$1',[user.legacy_customer_id]);
      }
      await db.query("INSERT INTO user_preferences(user_id,theme_id,language,created_by) SELECT $1,id,$2,$1 FROM themes WHERE code='ukr-blue' ON CONFLICT(user_id) DO NOTHING",[user.id,user.preferred_language]);
      const sessionRaw=token(),csrf=token(),sessionId=id(),expires=new Date(now+(challenge.kind==='staff'?28800000:1800000));
      if(challenge.kind==='staff')await db.query('INSERT INTO staff_sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,$4)',[digest(sessionRaw),user.staff_user_id,csrf,+expires]);
      await db.query('INSERT INTO sessions(id,user_id,kind,token_hash,csrf_hash,csrf_token_ciphertext,auth_version,expires_at,legacy_token_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$2)',[sessionId,user.id,challenge.kind,digest(sessionRaw),digest(csrf),seal(config,'csrf:'+sessionId,csrf),user.auth_version,expires,challenge.kind==='staff'?digest(sessionRaw):null]);
      await db.query('UPDATE otp_codes SET consumed_at=$1 WHERE id=$2',[new Date(now),challenge.id]);
      await db.query('UPDATE users SET last_login_at=$1 WHERE id=$2',[new Date(now),user.id]);
      await audit(db,user.id,'auth.verified','sessions',sessionId,null,{kind:challenge.kind,expires_at:expires});
      return {raw:sessionRaw,csrf,kind:challenge.kind,expires,userId:user.id};
    });if(result.error)fail(result.error==='too_many_requests'?429:400,result.error);return result;
  }
  async function authenticate(db,raw,kind,csrf=null,mutation=false){
    if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))fail(401,'sign_in_required');
    const session=await one(db,'SELECT * FROM sessions WHERE token_hash=$1 AND kind=$2 AND revoked_at IS NULL AND deleted_at IS NULL AND expires_at>$3',[digest(raw),kind,new Date(clock())]);
    if(!session)fail(401,'sign_in_required');const actor=await actorFor(db,session.user_id);
    if(actor.kind!==kind||actor.auth_version!==session.auth_version)fail(401,'sign_in_required');
    if(kind==='staff'&&(!session.legacy_token_hash||!await one(db,'SELECT token_hash FROM staff_sessions WHERE token_hash=$1 AND expires_at>$2',[session.legacy_token_hash,clock()])))fail(401,'sign_in_required');
    if(mutation&&(!csrf||!same(session.csrf_hash,digest(csrf))))fail(403,'csrf_failed');
    return {actor,session,csrf:unseal(config,'csrf:'+session.id,session.csrf_token_ciphertext)};
  }
  async function logout(db,context){await db.query('UPDATE sessions SET revoked_at=$1 WHERE id=$2',[new Date(clock()),context.session.id]);if(context.session.legacy_token_hash)await db.query('DELETE FROM staff_sessions WHERE token_hash=$1',[context.session.legacy_token_hash]);await audit(db,context.actor.id,'auth.logout','sessions',context.session.id);}
  async function testOutbox(raw){if(!config.testMode||!['test','development'].includes(config.mode))fail(404,'not_found');const code=await one(store,'SELECT * FROM otp_codes WHERE challenge_hash=$1 AND consumed_at IS NULL AND invalidated_at IS NULL AND expires_at>$2',[digest(raw||''),new Date(clock())]);if(!code)fail(404,'not_found');const row=await one(store,'SELECT * FROM email_outbox WHERE dedupe_key=$1 AND test_mode=true',['otp:'+code.id]);if(!row)return {messages:[]};const message=unseal(config,'email:'+row.id,row.body_ciphertext);return {messages:[{recipient:row.recipient,subject:row.subject,text:message.text}]};}
  return {begin,resend,verify,authenticate,logout,testOutbox};
}
