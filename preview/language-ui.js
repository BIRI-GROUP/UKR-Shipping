/* Migration adapter for the current draft. New components should use explicit data-i18n keys.
   Only known authored UI regions are eligible. Never translate user content or form values. */
(function () {
  'use strict';
  const selectors = [
    '.nav a','.nav summary','.utility-links a','.knowledge-nav a',
    '.footer h3','.footer a','.footer-links a',
    '#bookingTitle','.booking-heading p','.step-hint',
    '.service-tab strong','.service-tab small','#trackOpen','.track-label',
    '#searchTitle','#searchDescription','#serviceTag','#searchFields label.field',
    '#searchForm button','.search-foot span','#searchFields option',
    '#bookingForm label.field','#bookingForm label.check','#bookingForm button',
    '#reviewPanel label.check','#reviewPanel button','#reviewList dt',
    '#drawerTitle','#stepDetails','#stepReview','.drawer-steps > span:not(.line)',
    '#resultsService','#resultsList h3','#resultsList p','#resultsList small',
    '#resultsList strong','#resultsList b','#resultsList .tag','#resultsList button',
    '#editSearch','#backHome','#quotationOpen','#sortResults option',
    '#trackModal h2','#trackModal label.field','#trackModal button',
    '.coming-page main h1','.coming-page main h2','.coming-page main p',
    '.coming-page main a','.coming-page main small'
  ].join(',');
  const protectedSelectors = '[data-no-translate],[translate=no],[data-user-content],input,textarea,[contenteditable=true],#reviewList dd,#drawerRoute,#resultsTitle,#resultsSubtitle';
  const normalize = text => text.replace(/\s+/g,' ').trim();
  const catalog = window.UKRPageMessages || {};
  const sources = window.UKRPageSourceKeys || {};
  const missing = new Set();
  function update() {
    const locale = window.UKRLanguagePicker?.language || window.UKRLocales.normalize(document.documentElement.lang) || 'en';
    for (const element of document.querySelectorAll(selectors)) {
      if (element.closest(protectedSelectors) || element.hasAttribute('data-i18n')) continue;
      // HTML options without a value attribute derive their value from visible text.
      // Freeze the canonical value before any translation to protect API route/equipment keys.
      if (element.tagName==='OPTION' && !element.hasAttribute('value')) element.setAttribute('value',element.value);
      for (const text of [...element.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE)) {
        const source=normalize(text.nodeValue);if(!source)continue;
        const key=sources[source];
        if (!key) {if(/[A-Za-z]{3}/.test(source) && !/@|\+\d|https?:|UKR SEA/.test(source))missing.add(source);continue;}
        const span=document.createElement('span');span.dataset.i18n=key;span.textContent=source;span.lang='en';
        // A span is invalid inside a native option, whose label must stay plain text.
        if(element.tagName==='OPTION'){element.dataset.i18n=key;break;}
        text.replaceWith(span);
      }
    }
    for (const element of document.querySelectorAll('[data-i18n]')) {
      if(element.closest(protectedSelectors))continue;
      const key=element.dataset.i18n;const translated=catalog[locale]?.[key];const value=translated??catalog.en?.[key];
      if(value===undefined)continue;
      if(element.textContent!==value)element.textContent=value;
      const language=translated!==undefined?window.UKRLocales.languages.find(l=>l.id===locale).tag:'en';
      if(element.lang!==language)element.lang=language;
    }
    // Personal/cargo text may use a different writing direction from the selected interface.
    for(const el of document.querySelectorAll('#bookingForm input:not([type=checkbox]):not([type=email]):not([type=tel]):not([type=number]):not([type=file]),#bookingForm textarea,#reviewList dd,#drawerRoute,#resultsTitle')){
      if(el.dir!=='auto')el.dir='auto';el.setAttribute('translate','no');
    }
  }
  function start(){
    // The outer header is inert while a modal is open. Keep a native selector available inside the booking drawer.
    const drawerHead=document.querySelector('.drawer-head');
    if(drawerHead){
      const label=document.createElement('label');label.className='ukr-drawer-language';label.setAttribute('data-no-translate','');
      const caption=document.createElement('span');caption.textContent='Language';
      const select=document.createElement('select');select.id='ukr-drawer-language';select.setAttribute('aria-label','Language');
      for(const locale of window.UKRLocales.languages){const option=document.createElement('option');option.value=locale.id;option.textContent=locale.flag+' '+locale.name+' · '+locale.code;select.append(option);}
      const sync=()=>{const id=window.UKRLanguagePicker?.language||window.UKRLocales.normalize(document.documentElement.lang)||'en';select.value=id;const names={en:'Language',ar:'اللغة',ru:'Язык',fr:'Langue',ur:'زبان',hi:'भाषा',zh:'语言'};caption.textContent=names[id];select.setAttribute('aria-label',names[id]);};
      select.addEventListener('change',()=>window.UKRLanguagePicker?.setLanguage(select.value));window.addEventListener('ukr:languagechange',sync);sync();label.append(caption,select);drawerHead.append(label);
    }
    document.getElementById('serviceTabs')?.addEventListener('keydown',event=>{
      if(document.documentElement.dir!=='rtl'||!['ArrowRight','ArrowLeft'].includes(event.key))return;
      const tabs=[...document.querySelectorAll('.service-tab')],index=tabs.indexOf(event.target);if(index<0)return;
      event.preventDefault();event.stopImmediatePropagation();const next=tabs[(index+(event.key==='ArrowLeft'?1:tabs.length-1))%tabs.length];next.click();next.focus();
    },true);
    update();let queued=false;
    const observer=new MutationObserver(records=>{
      if(!records.some(record=>!(record.target.nodeType===1?record.target:record.target.parentElement)?.closest('[data-no-translate]')))return;
      if(!queued){queued=true;queueMicrotask(()=>{queued=false;observer.disconnect();update();observer.observe(document.body,{childList:true,subtree:true,characterData:true});});}
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('ukr:languagechange',()=>{observer.disconnect();update();observer.observe(document.body,{childList:true,subtree:true,characterData:true});});
    window.UKRLanguageCoverage=Object.freeze({untranslatedUI:()=>[...missing].sort(),complete:false});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
