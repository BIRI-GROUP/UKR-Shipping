import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {openDatabase,migrate} from '../../services/staff/phase1/db.mjs';
import {readConfig,id} from '../../services/staff/phase1/core.mjs';
import {syncStaff} from '../../services/staff/phase1/auth.mjs';
import {createHandler,hashPassword,verifyPassword} from '../../services/staff/server.mjs';
import {createPortalHandler} from '../../services/staff/phase1/http.mjs';
const url=process.env.TEST_DATABASE_URL;
assert.ok(url&&new URL(url).pathname.includes('test'),'A disposable test database is mandatory');
const schema='browser_'+id().replaceAll('-',''),admin=await openDatabase(url);await admin.query('CREATE SCHEMA '+schema);
const db=await openDatabase(url,{options:'-c search_path='+schema+',public'});
const config=readConfig({NODE_ENV:'test',AUTH_TEST_MODE:'true',APP_ORIGIN:'http://127.0.0.1:4191',PORTAL_ENCRYPTION_KEY:'b'.repeat(64)});
let server,browser;const errors=[],checks=[];const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);};
const evidence='tests/evidence/browser';await mkdir(evidence,{recursive:true});
try{
 await migrate(db);const hash=await hashPassword('Isolated-browser-password-0001');
 for(const [email,role]of [['bayan@ukrshipping.com','super_admin'],['browser-manager@example.test','management']])await db.tx(async q=>{const rid=id();await q.query('INSERT INTO staff_users(id,email,name,role,password_hash,active,created_at) VALUES($1,$2,$3,$4,$5,1,$6)',[rid,email,'Isolated '+role,role,hash,Date.now()]);await syncStaff(q,{id:rid,email,name:'Isolated '+role,role,active:1});});
 server=http.createServer(await createPortalHandler({store:db,config,passwords:{hashPassword,verifyPassword},legacyFactory:createHandler}));await new Promise(r=>server.listen(4191,'127.0.0.1',r));
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function login(kind,email,locale='en'){
  await page.goto(config.origin+'/'+kind+'/?lang='+locale);await page.locator('#loginForm input[name=email]').fill(email);
  if(kind==='staff')await page.locator('#loginForm input[name=password]').fill('Isolated-browser-password-0001');
  await page.locator('#loginForm button[type=submit]').click();await page.locator('#otpForm').waitFor({state:'visible'});
  await page.locator('#otpForm input[name=code]').fill('1234');await page.locator('#otpForm button[type=submit]').click();await page.locator('#appView').waitFor({state:'visible'});check(kind+' login '+locale,await page.locator('#appView').isVisible());
 }
 await login('staff','bayan@ukrshipping.com');
 check('staff shell has protected menu',await page.locator('#nav button').count()>5);
 await page.screenshot({path:evidence+'/staff-overview.png',fullPage:true});
 const modules=['tasks','masters','settings'];
 for(const name of modules){await page.evaluate(name=>window.UKRPortal.render(name),name);await page.waitForTimeout(150);check('no error on '+name,!(await page.locator('#error').inner_text()));}
 for(const width of [375,390,768,1024,1440]){await page.setViewportSize({width,height:1000});check('staff width '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.locator('#logout').click();await page.locator('#loginForm').waitFor({state:'visible'});
 for(const locale of ['en','ar','ru','fr','ur','hi','zh']){
  await login('customer','browser-'+locale+'@example.test',locale);
  check('language '+locale,await page.locator('html').getAttribute('lang')===(locale==='zh'?'zh-Hans':locale));
  check('direction '+locale,await page.locator('html').getAttribute('dir')===(['ar','ur'].includes(locale)?'rtl':'ltr'));
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});check(locale+' width '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  const denied=await page.evaluate(async()=>{const r=await fetch('/api/portal/settings/users');return r.status;});check('customer denied staff '+locale,denied===403);
  if(locale==='ar')await page.screenshot({path:evidence+'/customer-arabic.png',fullPage:true});
  await page.locator('#logout').click();await page.locator('#loginForm').waitFor({state:'visible'});
 }
 check('no JavaScript exceptions',errors.length===0);
 await writeFile(evidence+'/phase1-results.json',JSON.stringify({checks:checks.length,passed:checks,errors,usesRealPostgres:true,usesHttpServer:true,sendsRealEmail:false},null,2));
 console.log('UKR_BROWSER_PASS '+checks.length);
}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await db.close();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.close();}
