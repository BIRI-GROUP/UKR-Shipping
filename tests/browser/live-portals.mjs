/** Read-only checks of the designated UKR service. Never submits credentials or bookings. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='https://ukr-staff-staging.onrender.com';
const release='portal-access-2026-10-04';
const evidence='tests/evidence/live-portals';await mkdir(evidence,{recursive:true});
let status;
for(let n=0;n<40;n++){
 try{const r=await fetch(origin+'/api/portal/status',{signal:AbortSignal.timeout(12000)});if(r.ok){const v=await r.json();if(v.release===release){status=v;break;}}}catch{}
 await new Promise(r=>setTimeout(r,6000));
}
assert.ok(status,'The expected portal release must actually be published');
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
try{
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const kind of ['staff','customer'])for(const lang of ['en','ar','ru','fr','ur','hi','zh']){
  const r=await page.goto(origin+'/'+kind+'/?lang='+lang,{waitUntil:'networkidle',timeout:30000});check(kind+'/'+lang+' HTTP 200',r.status()===200);
  check(kind+'/'+lang+' actual application',await page.locator('#loginForm').isVisible());
  check(kind+'/'+lang+' language',await page.locator('html').getAttribute('lang')===(lang==='zh'?'zh-Hans':lang));
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});check(kind+'/'+lang+' width '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  if(lang==='en')await page.screenshot({path:evidence+'/'+kind+'-live.png',fullPage:true});
 }
 const denied=await context.request.get(origin+'/api/portal/me');check('Unauthenticated records are private',denied.status()===401);
 check('No JavaScript exceptions',errors.length===0);
 await writeFile(evidence+'/results.json',JSON.stringify({origin,release,status,checks,errors,liveBrowser:true,authenticatedLoginTested:false,emailsSent:0,recordsCreated:0},null,2));
 console.log('UKR_LIVE_PORTALS '+JSON.stringify({checks:checks.length,errors,signInAvailable:status.signInAvailable,authenticatedLoginTested:false}));
}finally{await browser.close();}
