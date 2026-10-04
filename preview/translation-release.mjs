import {readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import interfaceCopy from './locales/interface.mjs';
import knowledgeCopy from './locales/knowledge.mjs';
import operationCopy from './locales/operations.mjs';
import commonCopy from './locales/common.mjs';
export const order=['en','ar','ru','fr','ur','hi','zh'];
export const normalize=s=>String(s).replace(/\s+/g,' ').trim();
export const rows=[interfaceCopy,knowledgeCopy,operationCopy,commonCopy].flatMap(s=>s.trim().split('\n').map(line=>line.split('|').map(normalize)));
for(const row of rows){if(row.length!==7||row.some(value=>!value))throw Error('Incomplete locale row: '+row[0]);const variables=s=>[...s.matchAll(/\{([A-Za-z]+)\}/g)].map(m=>m[1]).sort().join(',');if(row.some(value=>variables(value)!==variables(row[0])))throw Error('Mismatched translation variables: '+row[0]);}
export const replacements=[
 ['UKR SHIPPING · DESIGN LAB','UKR SHIPPING · SEA · AIR · ROAD'],
 ['TEST PREVIEW · NO LIVE BOOKINGS','CONTACT UKR FOR BOOKING'],
 ['Test preview · No live bookings or payments','Rates and bookings require UKR confirmation.'],
 ['Test preview · No live bookings','Rates and bookings require UKR confirmation.'],
 ['TEST PREVIEW','CONTACT UKR FOR BOOKING'],
 ['Draft preview only. Live rates and bookings are not connected.','Rates and bookings require UKR confirmation.'],
 ['Enable JavaScript to try the interactive draft. For a shipping enquiry, email freight.dxb@ukrshipping.com.','Enable JavaScript to use the search and language selector. For a quote, email freight.dxb@ukrshipping.com.'],
 ['Review. Submit. You\'re on your way.','Review your shipment details.'],
 ['Send your booking for UKR review. Confirmation follows after final checks.','UKR confirms the rate, space and terms before a booking is accepted.'],
 ['Interactive draft.','Booking information.'],
 ['These are layout examples, not live schedules or offers. Prices, carrier, ETD, ETA, space and payment terms will come from approved UKR rate records.','Displayed options are not confirmed offers. Contact UKR for current rates, schedules, space and payment terms.'],
 ['example option layouts','unconfirmed options'],
 ['Preview booking','Review request'],['Route preview','Route details'],['Rate pending','Request rate'],
 ['Fill in your details. Review before submitting.','Review your details before contacting UKR.'],
 ['Preview only. No information or documents are sent or saved.','Information stays in this page. It is not sent or saved.'],
 ['03 Submit','03 Finish'],
 ['Preview: file names only, no upload. Maximum 5 files, 10 MB each.','File selection only; files are not uploaded. Maximum 5 files, 10 MB each.'],
 ['Cancellation terms, pay on arrival, online payment and installments depend on the selected UKR offer. They are not enabled in this draft.','Cancellation, payment on arrival, online payment and instalments are available only when stated in a confirmed UKR offer.'],
 ['I understand this is a preview, not a live booking. Final terms will be supplied with the confirmed offer.','I understand this form does not submit a booking. UKR must confirm the rate, space and terms.'],
 ['Submit my booking · Preview','Finish review'],['Booking preview complete','Your review is complete'],['Preview complete','Review complete'],
 ['This is how the submission screen will look. No actual booking has been created, no email sent and no payment taken.','No booking has been submitted, no email sent and no payment taken. Contact UKR to place your booking.'],
 ['In the connected system, your booking will be submitted for UKR approval and appear in the appropriate dashboards.','Send your booking request to UKR by phone or email.'],
 ['Tracking connection is coming soon. No shipment status has been retrieved. Contact the UKR team for an update.','Online tracking is unavailable. No shipment status has been retrieved. Contact UKR for an update.'],
 ['Coming in the next build: customer details, shipment documents and an official quotation valid for 48 hours, subject to final UKR approval. You can contact the team directly for a quotation now.','For an official quotation, send your company details and shipment documents to UKR. Validity is 48 hours, subject to final UKR approval. Online quotation generation is unavailable.'],
 ['Estimate downloads will be enabled when approved rates are available. This draft does not create an estimate or official price document.','A PDF estimate requires an approved UKR rate. Contact our team to obtain the estimate; no price document has been generated.'],
 ["We're upgrading this section. Check back soon, or contact our team for immediate assistance.",'Please contact our team for information about this service.'],
 ["We're getting this ready.",'Contact UKR for assistance.'],
 ['This section of the new UKR platform is coming soon. The existing website and dashboards have not been changed.','Please contact our team for information about this service.'],
 ['Please use test details only. This preview does not save bookings or documents and does not take payments.','Contact UKR for bookings, documents and payments.'],
 ['Back to booking preview','Back to shipping search'],
 ['Coming soon. This section will be added after its sources and comparison criteria have been reviewed.','Ask UKR about carrier options for your route.'],['Not published yet','Contact our team'],['Coming soon','Contact UKR'],
 ['Express options will use your approved provider rate files.','Express options use UKR-approved provider tariffs.'],
 ['China is the origin. Warehouse receiving details follow booking review. Sea DDP volume bands and starting prices will use your approved base rates.','China is the origin. Warehouse receiving details follow booking review. Sea DDP volume bands and starting prices use UKR-approved rates.'],
 ['China is the origin. Air DDP prices depend on chargeable weight and your approved tariff; sea-volume price bands do not apply.','China is the origin. Air DDP prices depend on chargeable weight and the approved tariff; sea-volume price bands do not apply.'],
 ['Provider tariffs, dimensional-weight rules and surcharges have not been loaded. Express rates are not yet available.','Contact UKR for express rates, dimensional-weight rules and applicable surcharges.'],
 ['Shipping options | UKR Shipping | Draft','Shipping options | UKR Shipping'],
 ['Book. Ship. Easy. | UKR Shipping | Homepage draft','Book & Ship. Made Simple. | UKR Shipping'],
 [' | UKR preview',' | UKR Shipping'],
 ['Quick quote: freight.dxb@ukrshipping.com','<span>Quick quote:</span> <span translate="no">freight.dxb@ukrshipping.com</span>']
];
export function wording(html){for(const [old,next]of replacements)html=html.replaceAll(old,next);return html;}
export function instrumentBooking(html){
  if(!html.includes('function routeText()'))return html;
  html=html.replace(/function routeText\(\)\{[^\n]*\}/,'function routeText(){return window.UKRTranslate.route(state.search);}')
    .replace(/function searchSummary\(\)\{[^\n]*\}/,'function searchSummary(){return window.UKRTranslate.summary(state.search);}')
    .replace("field('From','origin','text','value=\"China\" readonly')", "'<label class=\"field\">From<select name=\"origin\" required><option value=\"China\">China</option></select></label>'")
    .replace("dd.textContent=value;$('reviewList').append(dt,dd);", "dd.textContent=value;if(['Service','Rate'].includes(label)||(label==='Documents'&&!state.files.length)){dd.dataset.ukrAuthored='';dd.dataset.ukrSource=value;}if(label==='Route')dd.dataset.ukrRoute='';$('reviewList').append(dt,dd);")
    .replace(".label+' · '+searchSummary()", ".label+' · '+searchSummary()")
    .replace("window.scrollTo({top:0,behavior:'instant'});", "document.documentElement.dataset.titleSource=document.title;window.scrollTo({top:0,behavior:'instant'});")
    .replace(/<div class="success-ref" id="successRef">[^<]*<\/div>/,'')
    .replace('Send your booking request to UKR by phone or email.</p>','Send your booking request to UKR by phone or email.</p><p><a class="text-button" href="mailto:freight.dxb@ukrshipping.com">Quick quote</a> · <a href="tel:+97143888014" translate="no">+971 4 388 8014</a></p>');
  const extra=`\nwindow.UKRRefreshBookingLanguage=function(){if(!state.search)return;const service=services.find(s=>s.id===state.search.service);$('resultsTitle').textContent=routeText();$('resultsSubtitle').textContent=searchSummary();if($('bookingDrawer').open){$('drawerRoute').replaceChildren(document.createTextNode(routeText()));const p=document.createElement('p');p.textContent=window.UKRTranslate.text(service.label)+' · '+searchSummary();$('drawerRoute').append(p);}for(const dd of document.querySelectorAll('#reviewList dd[data-ukr-route]'))dd.textContent=routeText();for(const dd of document.querySelectorAll('#reviewList dd[data-ukr-authored]'))dd.textContent=window.UKRTranslate.text(dd.dataset.ukrSource);};\n`;
  html=html.replace('renderTabs();applyView();',extra+'renderTabs();applyView();');
  html=html.replace("openDialog('bookingDrawer');}","openDialog('bookingDrawer');window.UKRRefreshBookingLanguage();}");
  return html;
}
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27|#\d+);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'",'&nbsp;':' '}[e]??String.fromCodePoint(Number(e.slice(2,-1)))));
export function authoredStatic(html){html=html.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'');const texts=[];for(const m of html.matchAll(/>([^<>]+)</g))for(const part of decode(m[1]).split(' | ')){const s=normalize(part);if(s)texts.push(s);}for(const m of html.matchAll(/\b(?:aria-label|placeholder|alt|title)="([^"]*)"/g)){const s=normalize(decode(m[1]));if(s)texts.push(s);}return [...new Set(texts)];}
const neutral=s=>/^[×←→↗★\s/\d.,-]+$/.test(s)||!/[A-Za-z\u00c0-\u024f]/.test(s)||/^(UKR(?: SEA Shipping CO LLC| SHIPPING| Shipping)?|SHIPPING|© 2026 UKR SEA Shipping CO LLC|\+\d[\d\s-]*|[^\s@]+@[^\s@]+|[\d.,\s×]+(?:CBM|kg|m))$/u.test(s);
export async function completeTranslation(out='preview-dist'){
 const context={window:{}};vm.runInNewContext(await readFile(`${out}/i18n/page-messages.js`,'utf8'),context);const catalog=context.window.UKRPageMessages,sourceKeys=context.window.UKRPageSourceKeys;
 for(const row of rows){const key='complete.'+createHash('sha256').update(row[0]).digest('hex').slice(0,16);order.forEach((l,i)=>catalog[l][key]=row[i]);sourceKeys[row[0]]=key;}
 for(const source of Object.keys(sourceKeys)){const key=sourceKeys[source];if(order.some(l=>typeof catalog[l]?.[key]!=='string'||!catalog[l][key].trim()))throw Error('Missing language value: '+source);}
 const safeJSON=v=>JSON.stringify(v).replaceAll('<','\\u003c').replaceAll(String.fromCharCode(8232),'\\u2028').replaceAll(String.fromCharCode(8233),'\\u2029');
 await writeFile(`${out}/i18n/page-messages.js`,`window.UKRPageMessages=${safeJSON(catalog)};\nwindow.UKRPageSourceKeys=${safeJSON(sourceKeys)};\n`);
 await copyFile('preview/i18n-runtime.js',`${out}/i18n/preview-ui.js`);await copyFile('preview/i18n-complete.css',`${out}/i18n/complete.css`);
 let picker=await readFile(`${out}/i18n/picker.js`,'utf8');picker=picker.replace(/      let note=document.querySelector\('\.ukr-language-notice'\)[\s\S]*?      window.dispatchEvent/,"      window.dispatchEvent");await writeFile(`${out}/i18n/picker.js`,picker);
 const pages=[],missing={};
 async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory()){if(!['assets','data','i18n'].includes(e.name))await visit(`${dir}/${e.name}`);continue;}if(!e.name.endsWith('.html'))continue;const path=`${dir}/${e.name}`;let html=instrumentBooking(wording(await readFile(path,'utf8')));
 html=html.replace('<html ','<html data-ukr-translation-complete="true" ').replaceAll('/i18n/picker.css?v=1','/i18n/picker.css?v=2').replaceAll('/i18n/languages.js?v=1','/i18n/languages.js?v=2').replaceAll('/i18n/page-messages.js?v=1','/i18n/page-messages.js?v=2').replaceAll('/i18n/preview-ui.js?v=1','/i18n/preview-ui.js?v=2').replaceAll('/i18n/picker.js?v=1','/i18n/picker.js?v=2').replace('<script defer src="/i18n/preview-ui.js','<script src="/i18n/preview-ui.js').replace('</head>','<link rel="stylesheet" href="/i18n/complete.css?v=2"></head>');
 if(['portal.html','staff.html'].includes(e.name))html=html.replace('Please contact our team for information about this service.','Online account access is unavailable. Please contact UKR for assistance.');
 const title=html.match(/<title>([^<]*)<\/title>/)?.[1]||'';html=html.replace('<html ',`<html data-title-source="${title.replaceAll('"','&quot;')}" `);
 const unknown=authoredStatic(html).filter(s=>!neutral(s)&&!sourceKeys[s]&&!sourceKeys[s.replace(/^[←→↗★]\s*|\s*[←→↗]$/g,'')]);if(unknown.length)missing[path.slice(out.length+1)]=unknown;
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 await writeFile(path,html);pages.push(path.slice(out.length+1));}}
 await visit(out);
 if(Object.keys(missing).length){await writeFile(`${out}/translation-missing.json`,JSON.stringify(missing,null,2));throw Error('Untranslated authored copy: '+JSON.stringify(missing));}
 for(const f of ['i18n/page-messages.js','i18n/preview-ui.js','i18n/picker.js','knowledge.js','ports-ui.js'])new vm.Script(await readFile(`${out}/${f}`,'utf8'),{filename:f});
 const report={release:2,order,rtl:['ar','ur'],pages:pages.sort(),authoredTranslationComplete:true,translationStatus:'complete for current authored pages and interfaces',dictionaryEntries:Object.keys(sourceKeys).length,additionalRows:rows.length,missingKeys:Object.fromEntries(order.map(l=>[l,[]])),staticMissing:missing,externalTranslationCalls:false,protectedData:['customer input','documents','port identifiers','carrier names','company legal name'],bookingSubmissionEnabled:false};
 await writeFile(`${out}/language-checks.json`,JSON.stringify(report,null,2));const version=JSON.parse(await readFile(`${out}/version.json`,'utf8'));Object.assign(version,{translationRelease:2,translationComplete:true,languageOrder:order,translationCatalogSha256:createHash('sha256').update(JSON.stringify(catalog)).digest('hex')});await writeFile(`${out}/version.json`,JSON.stringify(version));console.log('UKR_FULL_TRANSLATION '+JSON.stringify(report));return report;
}
if(process.argv[1]?.endsWith('translation-release.mjs'))await completeTranslation();
