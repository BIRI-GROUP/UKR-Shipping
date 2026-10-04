import {mkdir,writeFile,readFile,stat,realpath,open,rename,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {id,uuid,must,one,audit,text} from './core.mjs';
// No public static route points at this private directory.
export function diskStorage(directory){must(typeof directory==='string'&&directory.startsWith('/'),500,'storage_directory_required');const base=resolve(directory);
 const path=key=>join(base,uuid(key));return Object.freeze({name:'disk',base,
 async put(bytes){must(Buffer.isBuffer(bytes)&&bytes.length<=10485760,413,'file_too_large');await mkdir(base,{recursive:true,mode:0o700});const key=id(),file=await open(path(key),'wx',0o600);try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}return {key,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};},
 async read(key){const p=path(key);const canonical=await realpath(p);must(canonical.startsWith(base+sep),403,'storage_access_denied');const size=(await stat(p)).size;must(size<=10485760,413,'file_too_large');return readFile(p);},
 async remove(key){await rm(path(key),{force:true});}
 });}
export async function registerFile(db,storage,actor,bytes,name,mediaType){const original=text(name,200,true);must(!/[\\/]/.test(original));must(['application/pdf','image/jpeg','image/png','application/octet-stream'].includes(mediaType));const saved=await storage.put(bytes);try{const row=await one(db,'INSERT INTO files(storage_key,original_name,sha256,byte_size,media_type,owner_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING id,status',[saved.key,original,saved.sha256,saved.size,mediaType,actor.id]);await audit(db,actor.id,'file.registered','files',row.id,null,{status:row.status,byte_size:saved.size});return row;}catch(e){await storage.remove(saved.key);throw e;}}
