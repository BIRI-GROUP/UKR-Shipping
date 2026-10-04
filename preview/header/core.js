/* Pure country preference policy. Stores country codes only, never visitor IPs. */
(function (root) {
  'use strict';
  const endpoint = 'https://api.country.is/';
  const manualKey = 'ukr-country-view-v1', cacheKey = 'ukr-country-ip-v1', cacheTTL = 21600000;
  function valid(code, countries) { return typeof code==='string' && /^[A-Z]{2}$/.test(code) && countries.some(c=>c.code===code); }
  function read(storage,key) { try { return storage?.getItem(key) || ''; } catch { return ''; } }
  function save(storage,key,value) { try { storage?.setItem(key,value); } catch {} }
  function initial(countries,local,session,now=Date.now()) {
    const manual=read(local,manualKey);
    if(valid(manual,countries))return {code:manual,source:'manual'};
    try { const cached=JSON.parse(read(session,cacheKey));
      if(Number.isFinite(cached.at)&&now>=cached.at&&now-cached.at<cacheTTL&&valid(cached.code,countries))return {code:cached.code,source:'ip'};
    } catch {}
    return {code:null,source:'unknown'};
  }
  async function detect(fetcher,countries,{timeout=4500}={}) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try {
      const response=await fetcher(endpoint,{method:'GET',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('Country lookup unavailable');
      const result=await response.json();
      if(!valid(result?.country,countries))throw new Error('Invalid country response');
      return result.country;
    } finally { clearTimeout(timer); }
  }
  function reference(value) {
    if(typeof value!=='string')return '';
    const clean=value.trim();
    return clean.length>=3&&clean.length<=80&&!/[\u0000-\u001f\u007f]/.test(clean)?clean:'';
  }
  function flag(code){return /^[A-Z]{2}$/.test(code||'')?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'';}
  root.UKRHeaderCore=Object.freeze({endpoint,manualKey,cacheKey,cacheTTL,valid,read,save,initial,detect,reference,flag});
})(typeof window==='undefined'?globalThis:window);
