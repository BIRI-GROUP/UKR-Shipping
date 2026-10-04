/** Hosted demonstration smoke check. It never authenticates operational accounts or creates cargo. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='https://ukr-staff-staging.onrender.com';
const release='username-demo-1';
const evidence='tests/evidence/live-portals';await mkdir(evidence,{recursive:true});
let status;
for(let n=0;n<40;n++){
 try{const r=await fetch(origin+'/api/portal/status',{signal:AbortSignal.timeout(12000)});if(r.ok){const v=await r.json();if(v.demo===true&&v.demoRelease===release&&v.signInAvailable===true){status=v;break;}}}catch{}
 await new Promise(r=>setTimeout(r,6000));
}
assert.ok(status,'The isolated demonstration must be active before sending any demonstration credentials');
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
try{
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const kind of ['staff','customer'])for(const lang of ['en','ar','ru','fr','ur','hi','zh']){
  const r=await page.goto(origin+'/'+kind+'/?lang='+lang,{waitUntil:'networkidle',timeout:30000});check(kind+'/'+lang+' HTTP 200',r.status()===200);
  check(kind+'/'+lang+' username form',await page.locator('#loginForm input[name=username]').isVisible());
  check(kind+'/'+lang+' username is not an email input',await page.locator('#loginForm input[name=username]').getAttribute('type')==='text');
  check(kind+'/'+lang+' submit enabled',await page.locator('#loginForm button[type=submit]').isEnabled());
  check(kind+'/'+lang+' language',await page.locator('html').getAttribute('lang')===(lang==='zh'?'zh-Hans':lang));
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});check(kind+'/'+lang+' width '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 }
 const denied=await context.request.get(origin+'/api/portal/me');check('Anonymous access denied',denied.status()===401);
 const sessions=[];
 for(const [kind,username] of [['staff','Admin'],['customer','customer']]){
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/'+kind+'/?lang=en',{waitUntil:'networkidle'});
  await p.locator('#loginForm input[name=username]').fill(username);
  await p.locator('#loginForm input[name=password]').fill('1234');
  await p.locator('#loginForm button[type=submit]').click();
  await p.locator('#appView').waitFor({state:'visible',timeout:20000});
  await p.waitForFunction(()=>document.getElementById('pageTitle').textContent.trim().length>0);
  check(kind+' dashboard opened',await p.locator('#appView').isVisible());
  check(kind+' no visible application error',(await p.locator('#error').textContent()).trim()==='');
  const me=await p.evaluate(async()=>{const r=await window.UKRPortal.request('/me');return {kind:r.user.kind,demo:r.demo};});
  check(kind+' correct test identity',me.kind===kind&&me.demo===true);
  check(kind+' OTP is not requested',!await p.locator('#otpForm').isVisible());
  await p.screenshot({path:evidence+'/'+kind+'-signed-in.png',fullPage:true});
  sessions.push(p);
 }
 for(const [index,kind] of ['staff','customer'].entries()){
  await sessions[index].reload({waitUntil:'networkidle'});
  check(kind+' session survives reload',await sessions[index].locator('#appView').isVisible());
 }
 for(const [index,kind] of ['staff','customer'].entries()){
  await sessions[index].locator('#logout').click();
  await sessions[index].locator('#authView').waitFor({state:'visible',timeout:15000});
  check(kind+' logout works',await sessions[index].locator('#loginForm').isVisible());
 }
 check('No JavaScript exceptions',errors.length===0);
 await writeFile(evidence+'/results.json',JSON.stringify({origin,release,checks,errors,liveBrowser:true,authenticatedDemoLoginTested:true,operationalAccountsUsed:false,emailsSent:0,cargoRecordsCreated:0},null,2));
 console.log('UKR_LIVE_USERNAME_CHECK '+JSON.stringify({checks:checks.length,errors,authenticatedDemoLoginTested:true}));
}finally{await browser.close();}
