import {spawn} from 'node:child_process';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile,readFile,rename,rm,stat,readdir} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {resolve,join} from 'node:path';
import {one,id,must,localClock} from './core.mjs';
async function encryptedCommand(program,args,target,key,env){
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce),child=spawn(program,args,{env,stdio:['ignore','pipe','pipe']});child.stderr.resume();
 const exit=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Object.assign(Error('backup_command_failed'),{code:'BACKUP_COMMAND_FAILED'})));});
 const temp=target+'.part',output=createWriteStream(temp,{flags:'wx',mode:0o600});output.write(Buffer.concat([Buffer.from('UKRB1'),nonce]));
 try{await Promise.all([pipeline(child.stdout,cipher,output),exit]);await writeFile(temp,cipher.getAuthTag(),{flag:'a'});await rename(temp,target);}catch(e){child.kill();await rm(temp,{force:true});throw e;}
 const hash=createHash('sha256');for await(const chunk of createReadStream(target))hash.update(chunk);return {sha256:hash.digest('hex'),bytes:(await stat(target)).size};
}
export async function dailyBackup(db,{databaseUrl,filesDirectory,backupDirectory,encryptionKey,retentionDays=14},now=Date.now()){
 must(databaseUrl&&filesDirectory&&backupDirectory&&/^[a-fA-F0-9]{64}$/.test(encryptionKey||''),500,'backup_configuration_required');must(Number.isInteger(retentionDays)&&retentionDays>=7&&retentionDays<=365);
 const files=resolve(filesDirectory),root=resolve(backupDirectory);must(!root.startsWith(files+'/')&&root!==files,500,'backup_directory_inside_files');await mkdir(files,{recursive:true,mode:0o700});await mkdir(root,{recursive:true,mode:0o700});
 const day=localClock(now).day;const claim=await db.tx(async q=>{const old=await one(q,'SELECT * FROM backup_runs WHERE backup_date=$1',[day]);if(old&&['running','completed'].includes(old.status))return null;return one(q,"INSERT INTO backup_runs(backup_date,status) VALUES($1,'running') ON CONFLICT(backup_date) DO UPDATE SET status='running',error_code=NULL RETURNING *",[day]);});if(!claim)return {alreadyClaimed:true};
 const key=Buffer.from(encryptionKey,'hex'),prefix=day+'-'+claim.id,sqlPath=join(root,prefix+'.pg.enc'),filesPath=join(root,prefix+'.files.enc');
 try{const database=await encryptedCommand('pg_dump',['--format=custom','--no-owner','--no-acl'],sqlPath,key,{...process.env,PGDATABASE:databaseUrl});const uploads=await encryptedCommand('tar',['-C',files,'-cf','-','.'],filesPath,key,process.env);
 const manifest={format:1,date:day,database:{file:prefix+'.pg.enc',...database},files:{file:prefix+'.files.enc',...uploads},encryption:'AES-256-GCM; header UKRB1, 12-byte IV, ciphertext, 16-byte authentication tag'};const body=JSON.stringify(manifest,null,2),manifestPath=join(root,prefix+'.json');await writeFile(manifestPath,body,{mode:0o600});await db.query("UPDATE backup_runs SET status='completed',manifest_path=$1,manifest_sha256=$2,completed_at=$3 WHERE id=$4",[manifestPath,createHash('sha256').update(body).digest('hex'),new Date(now),claim.id]);
 const expired=(await db.query("SELECT * FROM backup_runs WHERE status='completed' AND backup_date<$1 AND manifest_path IS NOT NULL",[new Date(now-retentionDays*86400000)])).rows;
 for(const row of expired){const p=resolve(row.manifest_path);if(!p.startsWith(root+'/'))continue;const m=JSON.parse(await readFile(p,'utf8'));for(const part of [m.database?.file,m.files?.file])if(part&&/^[\w.-]+$/.test(part))await rm(join(root,part),{force:true});await rm(p,{force:true});await db.query('UPDATE backup_runs SET manifest_path=NULL WHERE id=$1',[row.id]);}return manifest;
 }catch(e){await db.query("UPDATE backup_runs SET status='failed',error_code=$1,completed_at=$2 WHERE id=$3",['BACKUP_FAILED',new Date(now),claim.id]);throw e;}
}
