/* Shared Booking Lab header. IP lookup contains no shipment or customer input. */
(function () {
  'use strict';
  function start() {
    const C=window.UKRHeaderCore, countries=window.UKRHeaderCountries, U=()=>window.UKRTranslate;
    if(!C||!Array.isArray(countries)||!U())throw new Error('UKR header assets missing');
    const $=id=>document.getElementById(id), t=source=>U().text(source);
    let local,session;try{local=window.localStorage;}catch{}try{session=window.sessionStorage;}catch{}
    let state=C.initial(countries,local,session),busy=false,generation=0,feedback='',lastReference='';
    const countryTrigger=$('countryTrigger'),dialog=$('countryModal'),select=$('countrySelect');
    countryTrigger.disabled=false;countryTrigger.setAttribute('data-no-translate','');select.setAttribute('data-no-translate','');
    function countryName(code){return code?U().country(code):t('Select country');}
    function paint(){
      const current=state.code?countryName(state.code)+' · '+state.code:t('Select country');
      if($('countryCurrent').textContent!==current)$('countryCurrent').textContent=current;
      const flag=C.flag(state.code);const flagNode=countryTrigger.querySelector('.country-flag');if(flagNode.textContent!==flag)flagNode.textContent=flag;
      const source=state.source==='manual'?'Your selection':state.source==='ip'?'IP estimate':busy?'Detecting country…':'Change country';
      const caption=t(source);if($('countrySource').textContent!==caption)$('countrySource').textContent=caption;
      countryTrigger.setAttribute('aria-label',t('Change country')+': '+countryName(state.code));
      const message=t(feedback);if($('countryFeedback').textContent!==message)$('countryFeedback').textContent=message;
      $('countryDetect').disabled=busy;
    }
    function options(){
      const selected=select.value||state.code||'',fragment=document.createDocumentFragment(),empty=document.createElement('option');empty.value='';empty.textContent=t('Select country');fragment.append(empty);
      const locale=document.documentElement.lang||'en';
      const sorted=countries.map(c=>({...c,label:countryName(c.code)})).sort((a,b)=>a.label.localeCompare(b.label,locale));
      for(const c of sorted){const option=document.createElement('option');option.value=c.code;option.textContent=C.flag(c.code)+' '+c.label+' · '+c.code;fragment.append(option);}
      select.replaceChildren(fragment);select.value=selected;
    }
    function showCountry(){feedback='';options();paint();dialog.showModal();countryTrigger.setAttribute('aria-expanded','true');select.focus();}
    countryTrigger.addEventListener('click',showCountry);
    $('countryClose').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{countryTrigger.setAttribute('aria-expanded','false');countryTrigger.focus({preventScroll:true});});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
    $('countryForm').addEventListener('submit',event=>{
      event.preventDefault();if(!C.valid(select.value,countries)){feedback='Select country';paint();select.focus();return;}
      generation++;busy=false;state={code:select.value,source:'manual'};C.save(local,C.manualKey,state.code);feedback='Country view updated.';paint();dialog.close();
    });
    async function detectCountry(explicit=false){
      if(busy)return;const run=++generation;busy=true;feedback=explicit?'Detecting country…':'';paint();
      try {
        const code=await C.detect(window.fetch.bind(window),countries);
        if(run!==generation)return;
        // A manual selection made while the request is in flight always wins.
        state={code,source:'ip'};C.save(session,C.cacheKey,JSON.stringify({code,at:Date.now()}));
        if(explicit){try{local?.removeItem(C.manualKey);}catch{}select.value=code;feedback='Country view updated.';}
      } catch { if(run===generation){feedback='We could not detect your country. Please choose it from the list.';} }
      finally {if(run===generation){busy=false;paint();}}
    }
    $('countryDetect').addEventListener('click',()=>detectCountry(true));
    const nav=$('navigation'),toggle=$('menuToggle');
    const toggleName=()=>toggle.setAttribute('aria-label',t(toggle.getAttribute('aria-expanded')==='true'?'Close navigation':'Open navigation'));
    if(!$('serviceTabs'))toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
    toggle.addEventListener('click',toggleName);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){nav.querySelectorAll('details[open]').forEach(d=>d.open=false);if(nav.classList.contains('open')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggleName();toggle.focus();}}});
    document.addEventListener('pointerdown',event=>{if(!nav.contains(event.target))nav.querySelectorAll('details[open]').forEach(d=>d.open=false);});
    const form=$('heroTrackForm');
    function support(){
      if(!$('trackingEmail'))return;
      const ref=C.reference($('trackForm')?.elements.reference.value||lastReference);lastReference=ref;
      const refNode=$('trackingRequestedRef');refNode.textContent=ref;refNode.hidden=!ref;
      $('trackingEmail').href='mailto:freight.dxb@ukrshipping.com?subject='+encodeURIComponent(t('Shipment tracking update'))+'&body='+encodeURIComponent(t('Please provide an update for this shipment reference:')+'\n'+ref);
    }
    let trackingError='';
    function showTrackingError(source){trackingError=source;const el=$('heroTrackError');el.textContent=t(source);el.hidden=!source;$('heroTrackingReference').setAttribute('aria-invalid',String(!!source));}
    if(form){
      $('heroTrackSubmit').disabled=false;
      form.addEventListener('submit',event=>{
        event.preventDefault();const input=$('heroTrackingReference'),ref=C.reference(input.value);
        if(!ref){showTrackingError(input.value.trim()?'Use between 3 and 80 characters for the shipment reference.':'Enter a shipment reference to continue.');input.focus();return;}
        showTrackingError('');lastReference=ref;$('trackForm').elements.reference.value=ref;
        $('trackOpen').click();$('trackMessage').hidden=false;support();
      });
      $('heroTrackingReference').addEventListener('input',()=>showTrackingError(''));
      $('trackForm').addEventListener('submit',support);
      $('trackForm').elements.reference.addEventListener('input',support);
      $('trackModal').addEventListener('close',()=>$('heroTrackingReference').focus({preventScroll:true}));
    }
    window.addEventListener('ukr:languagechange',()=>{options();paint();toggleName();if(form){showTrackingError(trackingError);support();}});
    paint();options();toggleName();
    if(state.source==='unknown')void detectCountry();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
