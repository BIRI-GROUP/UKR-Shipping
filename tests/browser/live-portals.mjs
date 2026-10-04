/** Read-only verification of the designated private UKR review release. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='https://ukr-staff-staging.onrender.com';
const release='private-review-1234-v1';
const evidence='tests/evidence/live-portals';await mkdir(evidence,{recursive:true});
let status;
for(let n=0;n<50;n++){
 try{const r=await fetch(origin+'/api/portal/status',{signal:AbortSignal.timeout(12000)});if(r.ok){const v=await r.json();if(v.release===release){status=v;break;}}}catch{}
 await new Promise(r=>setTimeout(r,6000));
}
assert.ok(status,'The expected private review release must actually be published');
assert.equal(status.privateReview,true);assert.equal(status.signInAvailable,false);assert.equal(status.emailDeliveryConfigured,false);
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
try{
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const kind of ['staff','customer'])for(const lang of ['en','ar','ru','fr','ur','hi','zh']){
  const r=await page.goto(origin+'/'+kind+'/?lang='+lang,{waitUntil:'networkidle',timeout:30000});check(kind+'/'+lang+' HTTP 200',r.status()===200);
  check(kind+'/'+lang+' private gate visible',await page.locator('#reviewUnlock').isVisible());
  check(kind+'/'+lang+' identity form protected',await page.locator('#loginForm').count()===0);
  check(kind+'/'+lang+' language',await page.locator('html').getAttribute('lang')===lang);
  check(kind+'/'+lang+' direction',await page.locator('html').getAttribute('dir')===(['ar','ur'].includes(lang)?'rtl':'ltr'));
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});check(kind+'/'+lang+' width '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  if(lang==='en')await page.screenshot({path:evidence+'/'+kind+'-live.png',fullPage:true});
 }
 for(const path of ['/api/portal/me','/api/portal/bookings']){const denied=await context.request.get(origin+path);check(path+' requires private access',denied.status()===401);}
 check('No JavaScript exceptions',errors.length===0);
 await writeFile(evidence+'/results.json',JSON.stringify({origin,release,status,checks,errors,liveBrowser:true,authenticatedLoginTested:false,emailsSent:0,recordsCreated:0},null,2));
 console.log('UKR_LIVE_PORTALS '+JSON.stringify({checks:checks.length,errors,privateGateVerified:true,authenticatedLoginTested:false}));
}finally{await browser.close();}
