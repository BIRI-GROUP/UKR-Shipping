import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {order,rows} from './copy.mjs';
const icon = path => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const chevron=icon('<path d="m7 10 5 5 5-5"/>');
const user=icon('<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>');
const globe=icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>');
const search=icon('<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>');
const menu=icon('<path d="M3 6h18M3 12h18M3 18h18"/>');
export function headerMarkup(home=false){return `<header class="header ukr-header"><div class="wrap navline">
<a class="brand" href="${home?'#home':'/'}" aria-label="UKR Shipping"><img id="brandLogo" src="/assets/logo.svg?v=4" width="224" height="92" alt="UKR SEA Shipping CO LLC"><span id="brandFallback" hidden>UKR SHIPPING</span></a>
<div class="header-preferences utility-links" aria-label="Country and language"><div class="ukr-country-compact"><span class="country-caption">Country view</span><button id="countryTrigger" type="button" aria-haspopup="dialog" aria-controls="countryModal" aria-expanded="false" disabled><span class="country-flag" data-no-translate aria-hidden="true"></span><bdi id="countryCurrent" data-no-translate>Select country</bdi>${chevron}</button><span id="countrySource" class="country-source" data-no-translate></span></div><a class="header-staff" href="/staff.html">Staff login</a></div>
<button class="mobile-toggle" id="menuToggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="navigation">${menu}</button>
<nav class="nav" id="navigation" aria-label="Main navigation"><a ${home?'class="active" aria-current="page" ':''}id="bookNav" href="${home?'#home':'/'}">Book &amp; Ship</a><a href="/services.html">Services</a><details><summary>Information &amp; tools ${chevron}</summary><div class="dropdown"><a href="/knowledge.html">Knowledge Centre</a><a href="/tools.html">Shipping tools</a><a href="/routes.html">Routes &amp; destinations</a><a href="/careers.html">Join our team</a></div></details><a href="/news.html">News</a><a href="/contact.html">Contact us</a><a class="button portal-button" href="/portal.html">${user}<span>Customer Portal</span></a></nav>
${home?'<button id="trackOpen" type="button" hidden tabindex="-1" aria-hidden="true">Track shipment</button>':''}
</div></header>`;}
export function countryMarkup(){return `<dialog id="countryModal" class="ukr-country-modal" aria-labelledby="countryTitle"><div class="country-dialog-head"><h2 id="countryTitle">Choose your country view</h2><button type="button" id="countryClose" class="country-close" aria-label="Close country selection">×</button></div><p>Your country view does not change your language, shipping route or rates.</p><form id="countryForm" novalidate><label for="countrySelect">Country or territory</label><select id="countrySelect" name="country" required><option value="">Select country</option></select><p id="countryFeedback" class="country-feedback" role="status" data-no-translate></p><div class="country-actions"><button class="button" type="submit">Apply country</button><button class="button secondary" id="countryDetect" type="button">Use my IP country</button></div></form><div class="country-explanation"><p>Country detection uses your IP address, not your precise location. VPNs may affect the result.</p><p>Country.is receives the IP lookup request. No shipment details are sent to that provider.</p></div></dialog>`;}
export function trackingMarkup(){return `<section class="tracking-feature wrap" id="tracking" aria-labelledby="heroTrackingTitle"><div class="tracking-surface"><h2 id="heroTrackingTitle">Track your shipment</h2><p>Your shipment reference. One place to start.</p><form id="heroTrackForm" novalidate><label for="heroTrackingReference" class="ukr-track-label">UKR reference, bill of lading or container number</label><div class="tracking-input-row"><span class="tracking-input-icon">${search}</span><input id="heroTrackingReference" name="reference" type="text" maxlength="80" autocomplete="off" spellcheck="false" placeholder="UKR reference, bill of lading or container number" aria-describedby="heroTrackError" required><button id="heroTrackSubmit" type="submit" class="button" disabled>Track shipment ${search}</button></div><p class="error" id="heroTrackError" role="alert" hidden data-no-translate></p></form></div></section>`;}
const safeJSON=v=>JSON.stringify(v).replaceAll('<','\\u003c').replaceAll(String.fromCharCode(8232),'\\u2028').replaceAll(String.fromCharCode(8233),'\\u2029');
export function transformHeader(html,home){
  if(html.includes('class="header ukr-header"'))throw new Error('Header release already applied');
  html=html.replace(/<div class="utility">[\s\S]*?<\/div><\/div>\s*/, '');
  if(!/<header\b/.test(html))throw new Error('Header not found');
  html=html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/,headerMarkup(home));
  if(home){
    if(!/<section class="hero">[\s\S]*?<\/section>/.test(html))throw new Error('Homepage hero not found');
    html=html.replace(/(<section class="hero">[\s\S]*?)(<\/section>)/,(_,hero,end)=>hero+trackingMarkup()+end);
    const old=html.match(/<dialog class="modal" id="trackModal"[\s\S]*?<\/dialog>/)?.[0];
    if(!old)throw new Error('Tracking dialog not found');
    html=html.replace(old,old.replace('</dialog>','<p class="tracking-reference" id="trackingRequestedRef" translate="no" hidden></p><div class="tracking-support"><a id="trackingEmail" class="button secondary" href="mailto:freight.dxb@ukrshipping.com">Ask UKR for a tracking update</a><a href="tel:+97143888014" translate="no">+971 4 388 8014</a></div></dialog>'));
  }
  // Allow only this country lookup host. Booking and payment connections remain disallowed.
  html=html.replaceAll("connect-src 'none'","connect-src https://api.country.is");
  if(!html.includes('http-equiv="Content-Security-Policy"'))html=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src https://api.country.is; form-action 'none'; base-uri 'none'; object-src 'none'">`);
  html=html.replace('</head>','<link rel="stylesheet" href="/header/header.css?v=1"><script defer src="/header/countries.js?v=1"></script><script defer src="/header/core.js?v=1"></script><script defer src="/header/ui.js?v=1"></script></head>');
  html=html.replaceAll('/i18n/page-messages.js?v=2','/i18n/page-messages.js?v=header-1');
  return html.replace('</body>',countryMarkup()+'</body>');
}
export async function releaseHeader(out='preview-dist'){
  const ctx={window:{}};vm.runInNewContext(await readFile(`${out}/i18n/page-messages.js`,'utf8'),ctx);
  const {UKRPageMessages:catalog,UKRPageSourceKeys:keys}=ctx.window;
  for(const row of rows){const key='header.'+createHash('sha256').update(row[0]).digest('hex').slice(0,16);keys[row[0]]=key;order.forEach((l,i)=>catalog[l][key]=row[i]);}
  await writeFile(`${out}/i18n/page-messages.js`,`window.UKRPageMessages=${safeJSON(catalog)};\nwindow.UKRPageSourceKeys=${safeJSON(keys)};\n`);
  await mkdir(`${out}/header`,{recursive:true});
  for(const [source,target]of [['core.js','core.js'],['ui.js','ui.js'],['style.css','header.css']])await copyFile(new URL(source,import.meta.url),`${out}/header/${target}`);
  const portData=JSON.parse(await readFile(`${out}/data/ports.json`,'utf8'));
  const countries=portData.countries.map(({code,name})=>({code,name}));
  if(countries.length<200||countries.some(c=>!/^[A-Z]{2}$/.test(c.code)))throw new Error('Country directory incomplete');
  await writeFile(`${out}/header/countries.js`,`window.UKRHeaderCountries=${safeJSON(countries)};\n`);
  const report=JSON.parse(await readFile(`${out}/language-checks.json`,'utf8'));
  const {authoredStatic}=await import('../translation-release.mjs');
  const unknownFragments=[headerMarkup(true),countryMarkup(),trackingMarkup()].flatMap(authoredStatic).filter(s=>!keys[s]&&!/^(UKR|×)/.test(s));
  if(unknownFragments.length)throw new Error('Untranslated header: '+JSON.stringify(unknownFragments));
  const hashes={},preserve=html=>html.match(/<section class="wrap booking-wrap"[\s\S]*?<\/section>/)?.[0];
  for(const page of report.pages){const path=`${out}/${page}`,old=await readFile(path,'utf8'),home=page==='index.html';
    const updated=transformHeader(old,home);
    if(home){if(!preserve(old)||preserve(old)!==preserve(updated))throw new Error('Service search was changed');hashes.serviceBoxSha256=createHash('sha256').update(preserve(old)).digest('hex');
      if(old.match(/<img class="hero-photo"[^>]*>/)?.[0]!==updated.match(/<img class="hero-photo"[^>]*>/)?.[0])throw new Error('Hero artwork markup changed');}
    await writeFile(path,updated);
  }
  for(const file of ['header/core.js','header/ui.js','header/countries.js','i18n/page-messages.js'])new vm.Script(await readFile(`${out}/${file}`,'utf8'),{filename:file});
  for(const [source,key]of Object.entries(keys))for(const l of order)if(!catalog[l]?.[key])throw new Error('Missing translation '+source+'/'+l);
  Object.assign(report,{headerRelease:1,headerRows:rows.length,dictionaryEntries:Object.keys(keys).length,staticMissing:{}});
  await writeFile(`${out}/language-checks.json`,JSON.stringify(report,null,2));
  const result={release:1,pages:report.pages.length,languageOrder:order,headerRows:rows.length,countryCount:countries.length,countryEndpoint:'https://api.country.is/',countryFallback:'manual selection; no guessed country',trackingBackendConnected:false,...hashes};
  await writeFile(`${out}/header-checks.json`,JSON.stringify(result,null,2));
  const version=JSON.parse(await readFile(`${out}/version.json`,'utf8'));Object.assign(version,{headerRelease:1,connectPolicy:'https://api.country.is',translationCatalogSha256:createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),htmlSha256:createHash('sha256').update(await readFile(`${out}/index.html`)).digest('hex')});
  await writeFile(`${out}/version.json`,JSON.stringify(version));console.log('UKR_HEADER_RELEASE '+JSON.stringify(result));return result;
}
