import { randomUUID } from 'node:crypto';
import { validateRate,routeKey } from './rates.mjs';
import {readRoutes} from './routes.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export async function saveRate(db,input,user,audit,{id=null,dryRun=false}={}) {
  const rate=validateRate(input);
  if(rate.routeId){const route=(await readRoutes(db)).find(r=>r.id===rate.routeId);if(!route||!route.products.includes(rate.product))fail(400,'Select a service enabled on the permanent route.');if(rate.published&&!route.active)fail(400,'Activate the route before publishing.');if(routeKey(route.origin)!==routeKey(rate.origin)||routeKey(route.destination)!==routeKey(rate.destination))fail(400,'Route ports changed. Download or reopen the rate again.');}
  const old=id?(await db.query('SELECT * FROM freight_rates WHERE id=$1',[id])).rows[0]:null;
  if(id&&!old)fail(404,'Rate not found.');
  if(old&&old.version!==Number(input.version))fail(409,'This rate changed. Download or reopen the rate before saving.');
  id=old?.id||randomUUID();
  if(rate.published){const overlaps=(await db.query('SELECT id FROM freight_rates WHERE origin_key=$1 AND destination_key=$2 AND product=$3 AND published=1 AND valid_from<=$4 AND valid_to>=$5 AND id<>$6',[routeKey(rate.origin),routeKey(rate.destination),rate.product,rate.validTo,rate.validFrom,id])).rows;if(overlaps.length)fail(409,'Another published rate covers these dates for this route and product.');}
  if(dryRun)return {...rate,id:old?.id||null,version:old?.version||null};
  if(old)await db.query('UPDATE freight_rates SET version=version+1,origin_key=$1,destination_key=$2,product=$3,valid_from=$4,valid_to=$5,published=$6,data=$7,updated_by=$8,updated_at=$9 WHERE id=$10',[routeKey(rate.origin),routeKey(rate.destination),rate.product,rate.validFrom,rate.validTo,rate.published?1:0,JSON.stringify(rate),user.id,Date.now(),id]);
  else await db.query('INSERT INTO freight_rates (id,version,origin_key,destination_key,product,valid_from,valid_to,published,data,updated_by,updated_at) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,routeKey(rate.origin),routeKey(rate.destination),rate.product,rate.validFrom,rate.validTo,rate.published?1:0,JSON.stringify(rate),user.id,Date.now()]);
  await audit(db,user.id,rate.published?'rate.published':'rate.saved',id,`${rate.origin} → ${rate.destination}; ${rate.product}`);
  return {id,version:old?old.version+1:1};
}
