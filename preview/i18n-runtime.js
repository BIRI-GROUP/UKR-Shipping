/* UKR authored-copy translator. No external translation calls; customer content and canonical values are protected. */
(function () {
  'use strict';
  const L = window.UKRLocales, catalog = window.UKRPageMessages || {}, keys = window.UKRPageSourceKeys || {};
  if (!L) throw new Error('UKR language registry is missing');
  const root = document.documentElement, norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  let storage; try { storage = localStorage; } catch { storage = null; }
  const initial = L.resolve({pathname:location.pathname, search:location.search, saved:L.readSaved(storage), browser:navigator.languages || [navigator.language]});
  root.lang = L.languages.find(l=>l.id===initial.id).tag; root.dir = L.languages.find(l=>l.id===initial.id).dir; root.dataset.ukrI18n = initial.id;
  const locale = () => window.UKRLanguagePicker?.language || root.dataset.ukrI18n || 'en';
  const tag = () => L.languages.find(l=>l.id===locale()).tag;
  const sources = new Map(), reverse = new Map(), patterns = [], missing = new Set(), textRecords = new WeakMap(), attrRecords = new WeakMap(), bound = new Map();
  const escRE = s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for (const [source,key] of Object.entries(keys)) {
    sources.set(norm(source),key);
    if (source.includes('{')) {
      const names=[]; let at=0, expression='^';
      for(const match of source.matchAll(/\{([a-zA-Z]+)\}/g)){expression+=escRE(source.slice(at,match.index))+'(.+?)';names.push(match[1]);at=match.index+match[0].length;}
      expression+=escRE(source.slice(at))+'$';patterns.push({source,key,names,re:new RegExp(expression)});
    }
    for(const l of L.languages){const value=catalog[l.id]?.[key];if(typeof value==='string'&&!value.includes('{')&&!reverse.has(norm(value)))reverse.set(norm(value),source);}
  }
  const namesByCode=new Map(), codeByName=new Map();
  const countryAliases={UAE:'AE','United Arab Emirates':'AE','Saudi Arabia':'SA',Oman:'OM',Qatar:'QA',Kuwait:'KW',Bahrain:'BH',China:'CN',Turkey:'TR',Türkiye:'TR',Syria:'SY','Syrian Arab Republic':'SY','United Kingdom':'GB',UK:'GB',Canada:'CA',Jordan:'JO',Iraq:'IQ',India:'IN'};
  for(const [name,code]of Object.entries(countryAliases))codeByName.set(norm(name),code);
  const displays=Object.fromEntries(L.languages.map(l=>[l.id,new Intl.DisplayNames([l.tag],{type:'region'})]));
  function country(code,lang=locale()){try{return displays[lang].of(code);}catch{return namesByCode.get(code)||code;}}
  function indexCountries(countries){return countries.map(c=>{namesByCode.set(c.code,c.name);codeByName.set(norm(c.name),c.code);const translated=L.languages.map(l=>country(c.code,l.id));for(const name of translated)codeByName.set(norm(name),c.code);return {...c,aliases:[...(c.aliases||[]),...translated]};});}
  function number(value,options={}) {return new Intl.NumberFormat(tag(),options).format(value);}
  function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return value;return new Intl.DateTimeFormat(tag(),{dateStyle:'medium'}).format(new Date(value+'T12:00:00'));}
  function lookup(raw){
    const value=norm(raw); if(!value)return null;
    if(sources.has(value))return {source:value,key:sources.get(value),args:{}};
    const original=reverse.get(value);if(original)return {source:original,key:sources.get(original),args:{}};
    for(const p of patterns){const match=value.match(p.re);if(match)return {source:p.source,key:p.key,args:Object.fromEntries(p.names.map((name,i)=>[name,match[i+1]]))};}
    // Directional link ornaments are presentation, not dictionary content.
    const m=value.match(/^([←→↗★]\s*)?(.+?)(\s*[←→↗])?$/);
    if(m&&(m[1]||m[3])&&sources.has(m[2]))return {source:m[2],key:sources.get(m[2]),args:{},prefix:m[1]||'',suffix:m[3]||''};
    if(codeByName.has(value))return {country:codeByName.get(value),source:value};
    return null;
  }
  function text(source,args={}){
    const entry=lookup(source);if(!entry)return String(source ?? '');
    if(entry.country)return locale()==='en'?entry.source:country(entry.country);
    let value=catalog[locale()]?.[entry.key];if(typeof value!=='string')throw new Error('Missing UKR translation: '+entry.key+' / '+locale());
    const data={...entry.args,...args};value=value.replace(/\{([A-Za-z]+)\}/g,(_,k)=>Object.hasOwn(data,k)?(typeof data[k]==='number'?number(data[k]):String(data[k])):'{'+k+'}');
    const ornament=s=>root.dir==='rtl'?s.replace(/←|→/g,c=>c==='←'?'→':'←'):s;
    return ornament(entry.prefix||'')+value+ornament(entry.suffix||'');
  }
  function set(el,source,args={}){if(!el)return;bound.set(el,{source,args});el.setAttribute('data-ukr-bound','');el.textContent=text(source,args);}
  function place(value,code){const p=code&&window.UKR_PORT_DIRECTORY?.ports?.find(p=>p.code===code);if(p)return `${p.name}, ${country(p.countryCode)} (${p.code})`;return codeByName.has(norm(value))?country(codeByName.get(norm(value))):String(value||'');}
  function route(s){return s.service==='customs'?`${place(s.country)} · ${s.location||''}`:`${place(s.origin,s.originCode)} → ${place(s.destination,s.destinationCode)}`;}
  function summary(s){return [s.container?`${s.quantity} × ${text(s.container)}`:null,s.cbm?`${s.cbm} CBM`:null,s.weight?`${s.weight} kg`:null,s.truck?text(s.truck):null,s.clearance?text(s.clearance):null,s.ready?text('Cargo ready: {date}',{date:date(s.ready)}):null].filter(Boolean).join(' · ');}
  const protect='script,style,svg,noscript,textarea,[data-no-translate],[translate="no"],[data-user-content],[contenteditable="true"],[data-ukr-bound],#reviewList dd:not([data-ukr-authored]),#drawerRoute,#resultsTitle,#resultsSubtitle,.port-option > span:first-child';
  const safe = s=>/^[×←→↗★\s/\d.,-]+$/.test(s)||!/[A-Za-z\u00c0-\u024f]/.test(s)||/^(UKR(?: SEA Shipping CO LLC| SHIPPING| Shipping)?|SHIPPING|© 2026 UKR SEA Shipping CO LLC|\+\d[\d\s-]*|[^\s@]+@[^\s@]+|[\d.,\s×]+(?:CBM|kg|m)|[A-Z]{2}[A-Z0-9]{3}|20GP|40GP|40HC|45HC)$/u.test(s);
  function translateNode(node){
    const p=node.parentElement;if(!p||p.closest(protect))return;
    if(p.closest('.port-option small')){} // handled separately below
    const raw=node.nodeValue,current=norm(raw);if(!current)return;
    let rec=textRecords.get(node);
    if(!rec||raw!==rec.output){const entry=lookup(current);if(!entry){if(!safe(current))missing.add(current);return;}rec={source:current,prefix:raw.match(/^\s*/)[0],suffix:raw.match(/\s*$/)[0]};}
    const output=rec.prefix+text(rec.source)+rec.suffix;if(raw!==output)node.nodeValue=output;rec.output=output;textRecords.set(node,rec);
  }
  function translateAttributes(el){
    if(el.closest('[data-no-translate],[translate="no"],[data-user-content]'))return;
    let records=attrRecords.get(el);if(!records){records={};attrRecords.set(el,records);}
    for(const attr of ['placeholder','aria-label','title','alt']){const raw=el.getAttribute(attr);if(!raw)continue;let rec=records[attr];if(!rec||raw!==rec.output){if(!lookup(raw)){if(!safe(norm(raw))&&!el.closest('.port-option'))missing.add(norm(raw));continue;}rec={source:raw};}const output=text(rec.source);if(output!==raw)el.setAttribute(attr,output);rec.output=output;records[attr]=rec;}
  }
  function apply(){
    if(!document.body)return;missing.clear();
    if(window.UKR_PORT_DIRECTORY)indexCountries(window.UKR_PORT_DIRECTORY.countries);
    // Freeze every option's canonical value before replacing its display label.
    for(const el of document.querySelectorAll('option'))if(!el.hasAttribute('value'))el.setAttribute('value',el.value);
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode())translateNode(node);
    // Port names are identifiers; only their country descriptors are translated.
    for(const el of document.querySelectorAll('[data-ukr-country]')){const code=el.dataset.ukrCountry;const value=country(code)+(el.dataset.ukrMajor==='true'?' · '+text('Major port'):'');if(el.textContent!==value)el.textContent=value;}
    for(const el of document.querySelectorAll('option[data-country-code]')){const value=country(el.dataset.countryCode)+' ('+number(Number(el.dataset.portCount))+')';if(el.textContent!==value)el.textContent=value;}
    for(const el of document.querySelectorAll('[placeholder],[aria-label],[title],[alt]'))translateAttributes(el);
    for(const [el,record]of bound){if(!el.isConnected){bound.delete(el);continue;}const value=text(record.source,record.args);if(el.textContent!==value)el.textContent=value;}
    if(!root.dataset.titleSource)root.dataset.titleSource=document.title;
    const titleParts=root.dataset.titleSource.split(' | ');document.title=titleParts.map(s=>text(s)).join(' | ');
    for(const el of document.querySelectorAll('#bookingForm input:not([type=checkbox]):not([type=email]):not([type=tel]):not([type=number]):not([type=file]),#bookingForm textarea,#reviewList dd,#drawerRoute,#resultsTitle'))el.dir='auto';
    document.querySelector('.ukr-language-notice')?.remove();
  }
  function validationMessage(el){
    const v=el.validity;let source,args={};
    if(v.customError){source=el.dataset.ukrValidationSource||el.validationMessage;try{args=JSON.parse(el.dataset.ukrValidationArgs||'{}');}catch{args={};}}
    else if(v.valueMissing)source='Complete this field.';
    else if(v.typeMismatch&&el.type==='email')source='Enter a valid email address.';
    else if(v.badInput)source='Enter a valid number.';
    else if(v.rangeUnderflow){source='Enter {min} or more.';args={min:el.min};}
    else if(v.rangeOverflow){source='Enter {max} or less.';args={max:el.max};}
    else if(v.stepMismatch){source='Use increments of {step}.';args={step:el.step||'1'};}
    else source='Check the value in this field.';
    el.dataset.ukrValidationSource=source;el.dataset.ukrValidationArgs=JSON.stringify(args);
    const formatted=Object.fromEntries(Object.entries(args).map(([k,v])=>[k,el.type==='date'?date(v):v]));return text(source,formatted);
  }
  function start(){
    const drawerHead=document.querySelector('.drawer-head');if(drawerHead){const label=document.createElement('label');label.className='ukr-drawer-language';label.setAttribute('data-no-translate','');const caption=document.createElement('span');const select=document.createElement('select');select.id='ukr-drawer-language';for(const l of L.languages){const o=document.createElement('option');o.value=l.id;o.textContent=l.flag+' '+l.name+' · '+l.code;select.append(o);}const sync=()=>{select.value=locale();caption.textContent={en:'Language',ar:'اللغة',ru:'Язык',fr:'Langue',ur:'زبان',hi:'भाषा',zh:'语言'}[locale()];select.setAttribute('aria-label',caption.textContent);};select.addEventListener('change',()=>window.UKRLanguagePicker.setLanguage(select.value));window.addEventListener('ukr:languagechange',sync);sync();label.append(caption,select);drawerHead.append(label);}
    // Custom file caption avoids a browser-language-only filename control. Files remain on the device.
    const file=document.getElementById('documentInput');if(file){const chooser=document.createElement('button');chooser.type='button';chooser.className='button secondary ukr-file-button';chooser.textContent='Choose files';chooser.addEventListener('click',()=>file.click());const result=document.createElement('span');result.className='ukr-file-status';file.classList.add('ukr-file-native');file.after(chooser,result);const sync=()=>set(result,file.files.length?'{n} files selected':'No files selected',{n:file.files.length});file.addEventListener('change',sync);file.form?.addEventListener('reset',()=>setTimeout(sync));sync();}
    document.addEventListener('invalid',event=>{const el=event.target;if(!el.validity)return;if(el.validity.customError&&!el.dataset.ukrValidationSource)el.dataset.ukrValidationSource=el.validationMessage;const message=validationMessage(el);el.setCustomValidity(message);el.dataset.ukrNativeValidation='1';},true);
    document.addEventListener('input',event=>{const el=event.target;if(el.dataset?.ukrNativeValidation){el.setCustomValidity('');delete el.dataset.ukrNativeValidation;delete el.dataset.ukrValidationSource;delete el.dataset.ukrValidationArgs;}},true);
    document.addEventListener('change',event=>{const el=event.target;if(el.dataset?.ukrNativeValidation){el.setCustomValidity('');delete el.dataset.ukrNativeValidation;delete el.dataset.ukrValidationSource;delete el.dataset.ukrValidationArgs;}},true);
    document.getElementById('serviceTabs')?.addEventListener('keydown',event=>{if(root.dir!=='rtl'||!['ArrowRight','ArrowLeft'].includes(event.key))return;const tabs=[...document.querySelectorAll('.service-tab')],i=tabs.indexOf(event.target);if(i<0)return;event.preventDefault();event.stopImmediatePropagation();const next=tabs[(i+(event.key==='ArrowLeft'?1:tabs.length-1))%tabs.length];next.click();next.focus();},true);
    let busy=false,queued=false;const observe=()=>observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    function update(){if(busy)return;busy=true;observer.disconnect();apply();busy=false;observe();}
    const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;update();});}});
    update();window.addEventListener('ukr:languagechange',()=>{observer.disconnect();window.UKRRefreshBookingLanguage?.();for(const el of document.querySelectorAll('[data-ukr-native-validation]'))if(el.validity.customError)el.setCustomValidity(validationMessage(el));apply();observe();window.dispatchEvent(new Event('ukr:translated'));});
    window.UKRLanguageCoverage=Object.freeze({untranslatedUI:()=>[...missing].sort(),scan:()=>{update();return [...missing].sort();},complete:true,release:2});
    window.dispatchEvent(new Event('ukr:translated'));
  }
  window.UKRTranslate=Object.freeze({text,set,locale,number,date,country,indexCountries,route,summary,apply});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
