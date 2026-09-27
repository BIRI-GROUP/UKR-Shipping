import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage,pages} from '../site/public-v2/templates.mjs';
import {languages,messages,city,canonicalPlace} from '../site/public-v2/form-messages.mjs';
import {testStore} from '../services/staff/store.mjs';
import {addApprovedChinaRoutes} from '../services/staff/route-seed.mjs';
import {readRoutes,resolveRoutes} from '../services/staff/routes.mjs';
test('every page is fully generated in seven languages with matching navigation and direction',async()=>{
 const keys=Object.keys(messages.en).sort();
 for(const lang of Object.keys(languages)){
  assert.deepEqual(Object.keys(messages[lang]).sort(),keys);
  assert(Object.values(messages[lang]).every(v=>typeof v==='string'&&v.trim().length));
  for(const page of pages){
   const html=renderPage(page,lang);
   assert.match(html,new RegExp(`<html lang="${lang}" dir="${['ar','ur'].includes(lang)?'rtl':'ltr'}"`));
   assert(html.includes('UKR SEA SHIPPING CO LLC - Dubai'));
   assert(!html.includes('UKR staging'));assert(!html.includes('Customer Preview'));
   assert(!html.includes('undefined'));assert(!html.includes('No online payment'));
   const saved=await readFile(`site/${lang==='en'?'':lang+'/'}${page}.html`,'utf8');assert.equal(saved,html);
   const internal=[...html.matchAll(/href="(\/[^"?#]*)[^"]*"/g)].map(m=>m[1]);
   for(const href of internal){if(href.startsWith('/assets/'))continue;const pathname=href.endsWith('/')?href+'index.html':href;await readFile('site'+pathname);}
  }
 }
 assert(!renderPage('index').includes('Strait of Hormuz'));
 assert(renderPage('news').includes('Strait of Hormuz'));
 assert(renderPage('news').includes('UKR announcements'));
 assert(renderPage('services').includes('Minimum 1 CBM'));
});
test('route migration is atomic, idempotent, preserves existing routes and publishes no tariffs',async()=>{
 process.env.NODE_ENV='test';const store=await testStore();
 try{
  const existing={origin:'Ningbo, China',destination:'Jebel Ali, UAE',originCountry:'China',destinationCountry:'UAE',originAliases:['Custom city'],destinationAliases:['Dubai'],products:['AIR'],active:false};
  await store.query('INSERT INTO freight_routes (id,version,active,data,updated_at) VALUES ($1,3,0,$2,1)',['existing',JSON.stringify(existing)]);
  await addApprovedChinaRoutes(store);let routes=await readRoutes(store);assert.equal(routes.length,9);
  assert.equal(routes.find(r=>r.id==='existing').active,false);assert.equal(routes.find(r=>r.id==='existing').version,3);
  assert.equal(resolveRoutes(routes,{origin:'北京',destination:'迪拜'}).length,1);
  assert.equal(resolveRoutes(routes,{origin:'GZ',destination:'Dubai'}).length,1);
  for(const lang of Object.keys(languages)){
   assert.equal(canonicalPlace(city('Beijing',lang)+', '+city('China',lang)),'Beijing, China');
   assert.equal(resolveRoutes(routes,{origin:canonicalPlace(city('Beijing',lang)),destination:canonicalPlace(city('Dubai',lang)+', '+city('UAE',lang))}).length,1);
  }
  await store.query('UPDATE freight_routes SET active=0 WHERE id=$1',[routes.find(r=>r.origin==='Shanghai, China').id]);
  await addApprovedChinaRoutes(store);routes=await readRoutes(store);assert.equal(routes.length,9);assert.equal(routes.find(r=>r.origin==='Shanghai, China').active,false);
  assert.equal((await store.query('SELECT * FROM freight_rates')).rows.length,0);
 }finally{await store.close();}
});
