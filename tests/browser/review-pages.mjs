import {chromium} from './node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {openDatabase} from '../../services/staff/phase1/db.mjs';
import {startReview,REVIEW_SCHEMA} from '../../services/staff/review-gateway.mjs';
import {createHandler,hashPassword,verifyPassword} from '../../services/staff/server.mjs';
const url=process.env.TEST_DATABASE_URL;if(!url||!new URL(url).pathname.includes('test'))throw Error('Disposable database required');
const root=await openDatabase(url);await root.query('DROP SCHEMA IF EXISTS '+REVIEW_SCHEMA+' CASCADE');
const base='http://127.0.0.1:4299',env={NODE_ENV:'test',AUTH_TEST_MODE:'true',PORTAL_REVIEW_ENABLED:'true',APP_ORIGIN:base,DATABASE_URL:url,PORT:'4299',PORTAL_REVIEW_SCHEMA:REVIEW_SCHEMA,PORTAL_REVIEW_INITIALIZE:'true',PORTAL_REVIEW_ACCESS_HASH:createHash('sha256').update(randomBytes(32)).digest('hex'),PORTAL_REVIEW_KEY:randomBytes(32).toString('hex'),PORTAL_REVIEW_EXPIRES_AT:new Date(Date.now()+86400000).toISOString()};
const app=await startReview({env,passwords:{hashPassword,verifyPassword},legacyFactory:createHandler});const browser=await chromium.launch({headless:true});const errors=[];let checks=0;
await mkdir('tests/evidence/review-pages',{recursive:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of [390,1440])for(const kind of ['staff','customer'])for(const language of ['en','ar','ru','fr','ur','hi','zh']){
  await page.setViewportSize({width,height:900});await page.goto(base+'/'+kind+'/?lang='+language);
  await page.locator('#reviewLanguage option').last().waitFor({state:'attached'});
  assert.equal(await page.locator('html').getAttribute('dir'),['ar','ur'].includes(language)?'rtl':'ltr');checks++;
  assert.equal(await page.locator('#reviewUnlock').getAttribute('method'),'post');checks++;
  assert.equal(await page.locator('#reviewUnlock').getAttribute('action'),'/api/review/unlock');checks++;
  assert.equal(await page.locator('#reviewUnlock input[name=target]').inputValue(),kind);checks++;
  assert.equal(await page.locator('#loginForm').count(),0);checks++;
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;
 }
 assert.equal(errors.length,0);await page.screenshot({path:'tests/evidence/review-pages/locked-entry.png',fullPage:true});
 await writeFile('tests/evidence/review-pages/checks.json',JSON.stringify({checks,errors,scope:'Anonymous private-entry pages only. Does not assert authenticated browser login or hosted delivery.'},null,2));console.log('PRIVATE_ENTRY_BROWSER '+checks+' passed');
}finally{await browser.close();await app.stop();await root.query('DROP SCHEMA '+REVIEW_SCHEMA+' CASCADE');await root.close();}
