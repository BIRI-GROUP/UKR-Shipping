/* Shared UKR locale policy. Keep API identifiers, rates and customer data language-neutral. */
(function (root) {
  'use strict';
  const languages = Object.freeze([
    {id:'en',tag:'en',code:'EN',name:'English',flag:'🇬🇧',dir:'ltr'},
    {id:'ar',tag:'ar',code:'AR',name:'العربية',flag:'🇦🇪',dir:'rtl'},
    {id:'ru',tag:'ru',code:'RU',name:'Русский',flag:'🇷🇺',dir:'ltr'},
    {id:'fr',tag:'fr',code:'FR',name:'Français',flag:'🇫🇷',dir:'ltr'},
    {id:'ur',tag:'ur',code:'UR',name:'اردو',flag:'🇵🇰',dir:'rtl'},
    {id:'hi',tag:'hi',code:'HI',name:'हिन्दी',flag:'🇮🇳',dir:'ltr'},
    {id:'zh',tag:'zh-Hans',code:'ZH',name:'简体中文',flag:'🇨🇳',dir:'ltr'}
  ].map(Object.freeze));
  const storageKey = 'ukr.language.v1';
  function normalize(value) {
    if (typeof value !== 'string' || value.length > 64) return null;
    const tag = value.trim().replaceAll('_','-').toLowerCase();
    let canonical;
    try { canonical = Intl.getCanonicalLocales(tag)[0]; } catch { return null; }
    if (!canonical) return null;
    const id = canonical.split('-')[0];
    return languages.some(lang => lang.id === id) ? id : null;
  }
  function fromPath(path) {
    const segment = String(path || '/').split('/')[1];
    return languages.some(lang => lang.id === segment) ? segment : null;
  }
  function resolve({search='',pathname='/',saved=null,browser=[]}={}) {
    const explicit = normalize(new URLSearchParams(search).get('lang')) || fromPath(pathname);
    if (explicit) return {id:explicit,source:'url'};
    const remembered = normalize(saved);
    if (remembered) return {id:remembered,source:'saved'};
    for (const value of Array.isArray(browser) ? browser : [browser]) {
      const id = normalize(value);
      if (id) return {id,source:'browser'};
    }
    return {id:'en',source:'fallback'};
  }
  function readSaved(storage) {
    try { return normalize(storage.getItem(storageKey)); } catch { return null; }
  }
  function save(storage,id) {
    if (!languages.some(lang=>lang.id===id)) return false;
    try { storage.setItem(storageKey,id); return true; } catch { return false; }
  }
  function urlFor(href,id,mode='paths') {
    if (!languages.some(lang=>lang.id===id)) throw new RangeError('Unsupported UKR language');
    const url = new URL(href);
    if (!['https:','http:','file:'].includes(url.protocol)) throw new TypeError('Unsupported page URL');
    if (mode === 'inline') url.searchParams.set('lang',id);
    else {
      const old = fromPath(url.pathname);
      const rest = old ? url.pathname.replace(/^\/[^/]+(?:\/|$)/,'/') : url.pathname;
      url.pathname = (id==='en'?'':'/'+id) + rest;
      // An explicit English choice at / must not be overridden by browser detection.
      url.searchParams.set('lang',id);
    }
    return url.href;
  }
  const api = Object.freeze({languages,storageKey,normalize,fromPath,resolve,readSaved,save,urlFor});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UKRLocales = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
