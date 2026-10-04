/* Shared, local port lookup: no third-party requests and no customer data. */
(function(){
 'use strict';
 const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 function distance(a,b){if(Math.abs(a.length-b.length)>2)return 99;let v=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=v[0];v[0]=i;for(let j=1;j<=b.length;j++){const old=v[j];v[j]=Math.min(v[j]+1,v[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return v[b.length];}
 function index(ports,countries){const countryMap=new Map(countries.map(c=>[c.code,c]));return ports.map(p=>({...p,terms:clean([p.name,p.nameAscii,p.code,...(p.aliases||[])].join(' ')),countryTerms:clean([p.country,p.countryCode,...(countryMap.get(p.countryCode)?.aliases||[])].join(' ')),countryPriority:countryMap.get(p.countryCode)?.priority??999}));}
 function search(items,countries,q='',country='',destination=false){q=clean(q);let list=items.filter(p=>!country||p.countryCode===country);let mode='all';
 if(q){const ct=countries.filter(c=>[c.name,c.code,...(c.aliases||[])].some(a=>clean(a)===q));const cset=new Set(ct.map(c=>c.code));
 if(cset.size){list=list.filter(p=>cset.has(p.countryCode));mode='country';}else {const tokens=q.split(' ');const exact=list.filter(p=>tokens.every(t=>p.terms.includes(t)||p.countryTerms.includes(t)));if(exact.length){list=exact;mode='match';}else if(q.length>=4){list=list.filter(p=>[p.name,p.nameAscii,...(p.aliases||[])].some(a=>{const n=clean(a);return distance(q,n)<=Math.min(2,Math.floor(q.length/4))||n.split(' ').some(w=>distance(q,w)<=1);})||countries.some(c=>c.code===p.countryCode&&[c.name,...(c.aliases||[])].some(a=>distance(q,clean(a))<=1)));mode='suggestion';}else list=[];}}
 list.sort((a,b)=>{
 if(destination&&!q&&!country){if(a.code==='AEJEA')return -1;if(b.code==='AEJEA')return 1;}
 if(mode==='match'){const aa=[a.name,a.code,...(a.aliases||[])].some(x=>clean(x)===q),bb=[b.name,b.code,...(b.aliases||[])].some(x=>clean(x)===q);if(aa!==bb)return aa?-1:1;}
 return a.countryPriority-b.countryPriority||a.country.localeCompare(b.country)||a.priority-b.priority||a.name.localeCompare(b.name)||a.code.localeCompare(b.code);
 });return {items:list,mode};}
 let cached;
 function install(input,ports,countries){
 const U=window.UKRTranslate;countries=U?U.indexCountries(countries):countries;
 if(!cached)cached=index(ports,countries);const root=input.closest('.port-field'),popup=root.querySelector('.combo-list'),list=root.querySelector('[role=listbox]'),country=root.querySelector('select'),more=root.querySelector('.port-more'),status=root.querySelector('.port-status');
 const counts=new Map();ports.forEach(p=>counts.set(p.countryCode,(counts.get(p.countryCode)||0)+1));
 for(const c of countries){if(!counts.has(c.code))continue;const o=document.createElement('option');o.value=c.code;o.dataset.countryCode=c.code;o.dataset.portCount=counts.get(c.code);o.setAttribute('data-no-translate','');o.textContent=(U?U.country(c.code):c.name)+' ('+counts.get(c.code)+')';country.append(o);}
 let hits=[],active=-1,limit=40;
 function close(){popup.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
 function select(p){input.value=p.value;root.querySelector('[name="'+input.name+'Code"]').value=p.code;root.querySelector('[name="'+input.name+'Country"]').value=p.countryCode;input.setCustomValidity('');close();input.focus({preventScroll:true});close();}
 function paint(){list.replaceChildren();const isSelected=ports.some(p=>p.value===input.value);const result=search(cached,countries,isSelected?'':input.value,country.value,input.name==='destination');hits=result.items;active=-1;
 const statusSource=country.value?'{n} ports in this country. Major ports first; remaining ports alphabetical.':'{n} ports. Major ports first; remaining ports alphabetical.';
 if(U)U.set(status,statusSource,{n:hits.length});else status.textContent=statusSource.replace('{n}',String(hits.length));
 root.querySelectorAll('.port-suggestion').forEach(el=>el.remove());if(result.mode==='suggestion'){const note=document.createElement('span');note.className='port-suggestion';note.textContent='Possible spelling matches';status.before(note);}
 let group=null,previous='';for(const [i,p]of hits.slice(0,limit).entries()){
 if(p.country!==previous){group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label',U?U.country(p.countryCode):p.country);const heading=document.createElement('div');heading.className='combo-label';heading.dataset.ukrCountry=p.countryCode;heading.setAttribute('data-no-translate','');heading.textContent=U?U.country(p.countryCode):p.country;heading.setAttribute('role','presentation');group.append(heading);list.append(group);previous=p.country;}
 const row=document.createElement('div');row.id=input.id+'-option-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.className='port-option';const label=document.createElement('span');label.textContent=p.name;const sub=document.createElement('small');sub.dataset.ukrCountry=p.countryCode;sub.dataset.ukrMajor=String(p.priority<999);sub.setAttribute('data-no-translate','');sub.textContent=(U?U.country(p.countryCode):p.country)+(p.priority<999?' · '+(U?U.text('Major port'):'Major port'):'');label.append(sub);const code=document.createElement('span');code.className='code';code.setAttribute('translate','no');code.textContent=p.code;row.append(label,code);row.addEventListener('mousedown',e=>e.preventDefault());row.addEventListener('click',()=>select(p));group.append(row);}
 more.hidden=hits.length<=limit;if(U)U.set(more,'Show more ports ({n} remaining)',{n:Math.max(0,hits.length-limit)});else more.textContent='Show more ports';if(!hits.length){const e=document.createElement('p');e.className='combo-none';e.textContent='No maritime port matches. Try the country, another spelling or a UN/LOCODE. Contact UKR for unlisted locations.';list.append(e);}
 popup.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
 }
 input.addEventListener('focus',()=>{limit=40;paint();});input.addEventListener('input',()=>{root.querySelector('[name="'+input.name+'Code"]').value='';root.querySelector('[name="'+input.name+'Country"]').value='';input.setCustomValidity('');limit=40;paint();});
 country.addEventListener('change',()=>{input.value='';root.querySelector('[name="'+input.name+'Code"]').value='';root.querySelector('[name="'+input.name+'Country"]').value='';limit=40;paint();});more.addEventListener('click',()=>{limit+=40;paint();});root.addEventListener('focusout',()=>setTimeout(()=>{if(!root.contains(document.activeElement))close();},160));document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))close();});
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(popup.hidden)paint();if(!hits.length)return;const count=Math.min(limit,hits.length);active=(active+(e.key==='ArrowDown'?1:count-1)+count)%count;list.querySelectorAll('[role=option]').forEach((r,i)=>r.setAttribute('aria-selected',String(i===active)));const row=document.getElementById(input.id+'-option-'+active);input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});}else if(e.key==='Enter'&&!popup.hidden&&active>=0){e.preventDefault();select(hits[active]);}});
 }
 window.UKRPortSearch={clean,distance,index,search,install};
})();
