/* One selector for generated public pages and the isolated booking preview. */
(function () {
  'use strict';
  const L = window.UKRLocales;
  if (!L) throw new Error('Load languages.js before picker.js');
  const noticeText = {
    en:'Translation preview: some content is still in English. Customer-entered details remain unchanged.',
    ar:'معاينة الترجمة: بعض المحتوى ما زال بالإنجليزية. تبقى بيانات العميل كما أدخلها.',
    ru:'Предпросмотр перевода: часть текста пока на английском. Данные клиента не изменяются.',
    fr:'Aperçu de traduction : certains contenus restent en anglais. Les données saisies restent inchangées.',
    ur:'ترجمے کا پیش منظر: کچھ مواد ابھی انگریزی میں ہے۔ صارف کی درج کردہ معلومات تبدیل نہیں ہوں گی۔',
    hi:'अनुवाद पूर्वावलोकन: कुछ सामग्री अभी अंग्रेज़ी में है। ग्राहक की दर्ज की गई जानकारी नहीं बदलेगी।',
    zh:'翻译预览：部分内容仍为英文。客户输入的信息保持不变。'
  };
  const names = {en:'Language',ar:'اللغة',ru:'Язык',fr:'Langue',ur:'زبان',hi:'भाषा',zh:'语言'};
  const root = document.documentElement;
  const mode = root.dataset.ukrLanguageMode || 'paths';
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const preference = L.resolve({pathname:location.pathname,search:location.search,saved:L.readSaved(storage),browser:navigator.languages || [navigator.language]});
  let current = preference.id;
  const meta = id => L.languages.find(item=>item.id===id);
  const make = (tag,cls,text) => {const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  function run() {
    if (document.querySelector('.ukr-language')) return;
    const rendered = L.normalize(root.lang) || 'en';
    if (mode==='paths' && rendered!==current) { location.replace(L.urlFor(location.href,current)); return; }
    const legacy = document.getElementById('language');
    if (legacy) {
      legacy.hidden=true;legacy.setAttribute('aria-hidden','true');legacy.tabIndex=-1;
      const label=legacy.closest('label');if(label)label.hidden=true;
    }
    const host = document.querySelector('.utility-links') || document.querySelector('.topbar .wrap > div') || document.querySelector('.knowledge-nav') || document.querySelector('.coming-page header') || document.querySelector('header .wrap') || document.querySelector('header');
    const widget=make('div','ukr-language');widget.setAttribute('data-no-translate','');
    const trigger=make('button','ukr-language-trigger');trigger.type='button';trigger.id='ukr-language-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','ukr-language-list');
    trigger.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/></svg>';
    const flag=make('span','ukr-flag');flag.setAttribute('aria-hidden','true');
    const currentName=make('bdi','ukr-current-name');const code=make('span','ukr-code');code.dir='ltr';
    trigger.append(flag,currentName,code);
    const chevron=document.createElementNS('http://www.w3.org/2000/svg','svg');chevron.setAttribute('viewBox','0 0 24 24');chevron.setAttribute('aria-hidden','true');chevron.classList.add('ukr-chevron');chevron.innerHTML='<path d="m6 9 6 6 6-6"/>';trigger.append(chevron);
    const list=make('div','ukr-language-list');list.id='ukr-language-list';list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',trigger.id);
    const status=make('span','ukr-language-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    let active=0;
    const buttons=L.languages.map((item,index)=>{
      const button=make('button','ukr-language-option');button.type='button';button.setAttribute('role','option');button.dataset.lang=item.id;button.tabIndex=-1;
      const f=make('span','ukr-flag',item.flag);f.setAttribute('aria-hidden','true');const n=make('bdi','',item.name);n.lang=item.tag;n.dir=item.dir;const c=make('span','ukr-code',item.code);c.dir='ltr';button.append(f,n,c);
      button.addEventListener('click',()=>select(item.id));
      button.addEventListener('keydown',event=>{let next=null;if(event.key==='ArrowDown')next=(index+1)%buttons.length;else if(event.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else if(event.key==='Escape'){event.preventDefault();close(true);return;}else if(event.key==='Tab'){close(false);return;}if(next!==null){event.preventDefault();active=next;buttons[next].focus();}});
      list.append(button);return button;
    });
    function paint(){const item=meta(current);flag.textContent=item.flag;currentName.textContent=item.name;currentName.lang=item.tag;currentName.dir=item.dir;code.textContent=item.code;trigger.setAttribute('aria-label',names[current]+': '+item.name);buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(button.dataset.lang===current));button.tabIndex=-1;if(button.dataset.lang===current)active=i;});}
    function close(focus){list.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
    function open(){list.hidden=false;trigger.setAttribute('aria-expanded','true');buttons[active].focus();}
    function inline(){
      root.lang=meta(current).tag;root.dir=meta(current).dir;root.dataset.ukrI18n=current;
      // Only explicit keyed UI nodes are translated. Form values and files are never rewritten.
      const catalog=window.UKRPageMessages || {};
      for(const el of document.querySelectorAll('[data-i18n]')){const key=el.dataset.i18n;const text=catalog[current]?.[key]??catalog.en?.[key];if(text!==undefined)el.textContent=text;}
      let note=document.querySelector('.ukr-language-notice');if(!note){note=make('div','ukr-language-notice');note.setAttribute('data-no-translate','');const header=document.querySelector('header');if(header)header.after(note);else document.body.prepend(note);}
      note.textContent=noticeText[current];note.lang=meta(current).tag;note.dir=meta(current).dir;note.hidden=current==='en'||root.dataset.ukrTranslationComplete==='true';
      window.dispatchEvent(new CustomEvent('ukr:languagechange',{detail:{language:current}}));
    }
    function select(id){
      current=id;L.save(storage,id);paint();close(true);status.textContent=meta(id).name;
      if(mode==='inline'){try{history.replaceState(history.state,'',L.urlFor(location.href,id,'inline'));}catch{}inline();}
      else if(legacy && [...legacy.options].some(option=>option.value===id)){
        // The legacy handler preserves location.search; update lang first to avoid a stale-query redirect loop.
        try{const next=new URL(location.href);next.searchParams.set('lang',id);history.replaceState(history.state,'',next.href);}catch{}
        legacy.value=id;legacy.dispatchEvent(new Event('change',{bubbles:true}));
      }else location.assign(L.urlFor(location.href,id));
    }
    trigger.addEventListener('click',()=>list.hidden?open():close(false));
    trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();}else if(event.key==='Escape')close(false);});
    document.addEventListener('pointerdown',event=>{if(!widget.contains(event.target))close(false);});
    document.addEventListener('focusin',event=>{if(!widget.contains(event.target))close(false);});
    widget.append(trigger,list,status);
    if(host)host.append(widget);else{const bar=make('div','ukr-language-fallback');bar.append(widget);document.body.prepend(bar);}
    paint();if(mode==='inline')inline();else{root.dir=meta(current).dir;root.dataset.ukrI18n=current;}
    // Carry only the language on preview links, never customer or shipment details.
    if(mode==='inline')document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download'))return;const raw=link.getAttribute('href');if(!raw||raw.startsWith('#'))return;let url;try{url=new URL(link.href,location.href);}catch{return;}if(url.origin!==location.origin||!/\/$|\.html$/.test(url.pathname))return;url.searchParams.set('lang',current);link.href=url.href;},true);
    window.UKRLanguagePicker=Object.freeze({get language(){return current;},setLanguage(id){if(L.languages.some(item=>item.id===id))select(id);}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
