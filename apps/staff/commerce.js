'use strict';
let tariffData = null;
const tariffProducts = {FCL20:'Sea · 20′ container',FCL40:'Sea · 40′ container',FCL40HC:'Sea · 40′ high cube',LCL:'Sea · LCL',LCL_DDP:'Sea · LCL DDP',AIR:'Air cargo',AIR_DDP:'Air · DDP',ROAD_LTL:'Road · Shared truck'};
const tariffPlaces = ['Ningbo, China','Shanghai, China','Shenzhen, China','Guangzhou, China','Qingdao, China','Xiamen, China','Tianjin, China','Jebel Ali, UAE','Dubai, UAE','Abu Dhabi, UAE','DXB Airport, UAE','DWC Airport, UAE','Jeddah, Saudi Arabia','Dammam, Saudi Arabia','Riyadh, Saudi Arabia','Doha, Qatar','Kuwait City, Kuwait','Sohar, Oman','Salalah, Oman'];
const priceText = (amount,currency) => new Intl.NumberFormat('en',{style:'currency',currency}).format(amount);
function rateStatus(r) { return !r.published?'Draft':r.validTo<new Date().toISOString().slice(0,10)?'Expired':'Published'; }
async function ratesPage() {
  const content=page('Weekly rates'); tariffData=await api('/rates');
  const intro=panel('Your buying cost. Your selling price.','Enter a tariff, set its validity and markup, then publish it to the website. Customer estimates never include buying costs or private notes.');
  intro.append(button('＋ Add a rate',()=>editTariff(), 'primary'));content.append(intro);
  const toolbar=element('div',undefined,'tariff-toolbar'), search=element('input');search.type='search';search.placeholder='Filter by route or product';search.setAttribute('aria-label','Filter rates');toolbar.append(search,element('span',`${tariffData.rates.length} saved rates`,'helper'));content.append(toolbar);
  const list=element('div',undefined,'tariff-list');content.append(list);
  function render(){list.replaceChildren();const matches=tariffData.rates.filter(r=>`${r.origin} ${r.destination} ${tariffProducts[r.product]}`.toLowerCase().includes(search.value.toLowerCase()));
    if(!matches.length){list.append(element('p','No matching rates. Add a rate to make it available to customers.','empty'));return;}
    for(const r of matches){const card=element('article',undefined,'tariff-card'),head=element('div',undefined,'tariff-card-head');head.append(element('h3',`${r.origin} → ${r.destination}`),element('span',rateStatus(r),'pill'));card.append(head,element('p',`${tariffProducts[r.product]} · ${r.validFrom} to ${r.validTo}`,'helper'));
      const stats=element('div',undefined,'rate-numbers');for(const [label,value] of [['Buying cost',priceText(r.buyRate,r.currency)],['Markup',r.markupType==='percent'?r.markup+'%':priceText(r.markup,r.currency)],['Customer rate',priceText(r.unitPrice,r.currency)]]){const box=element('div');box.append(element('span',label),element('strong',value));stats.append(box);}card.append(stats,element('p',`${r.basis.replaceAll('_',' ')} · ${r.bookingMode==='auto'?'Automatic UKR acceptance':`Staff confirmation target: ${r.responseMinutes} minutes`}`,'helper'));
      const actions=element('div',undefined,'tariff-actions');actions.append(button('Edit rate',()=>editTariff(r)),button('Copy to next week',()=>{const copy={...r,id:undefined,version:undefined,published:false};for(const k of ['validFrom','validTo']){const d=new Date(r[k]+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+7);copy[k]=d.toISOString().slice(0,10);}editTariff(copy);}));card.append(actions);list.append(card);
    }}search.addEventListener('input',render);render();
}
function tariffField(form,key,label,value,type='text',options=null,help='') {
  const wrap=element('div',undefined,'tariff-field'), lab=element('label',label);lab.htmlFor='tariff_'+key;
  const input=element(options?'select':type==='textarea'?'textarea':'input');input.id=lab.htmlFor;input.name=key;
  if(options)for(const [id,text] of Object.entries(options)){const o=element('option',text);o.value=id;input.append(o);}
  else if(type!=='textarea')input.type=type;
  input.value=value??'';
  if(type==='number'){input.min='0';input.step='any';}
  if(type==='textarea'){input.rows=3;input.maxLength=1800;wrap.classList.add('wide');}
  if(['origin','destination'].includes(key)){input.setAttribute('list','tariffPlaces');input.maxLength=120;}
  if(!['publicNotes','internalNotes','deliveryArea'].includes(key))input.required=true;
  wrap.append(lab,input);if(help)wrap.append(element('p',help,'helper'));form.append(wrap);return input;
}
function editTariff(rate=null) {
  const start=new Date().toISOString().slice(0,10),end=new Date(Date.now()+6*86400000).toISOString().slice(0,10);
  const r=rate||{origin:'Ningbo, China',destination:'Jebel Ali, UAE',product:'LCL',label:'',validFrom:start,validTo:end,currency:'USD',buyRate:'',markupType:'percent',markup:'',basis:'wm',minimumUnits:1,rounding:.01,minimumCharge:0,kgPerCbm:475,volumetricDivisor:6000,originFee:0,destinationFee:0,documentationFee:0,maxWeight:'',maxCbm:'',maxDensity:0,inclusions:'',exclusions:'',bookingMode:'review',responseMinutes:60,published:false};
  const content=page(rate?.id?'Edit weekly rate':'Add weekly rate');content.append(button('← All rates',ratesPage));
  const form=element('form',undefined,'panel tariff-editor'),placeList=element('datalist');placeList.id='tariffPlaces';for(const place of tariffPlaces){const o=element('option');o.value=place;placeList.append(o);}form.append(placeList);
  const fields={};
  function section(title){form.append(element('h2',title));const g=element('div',undefined,'tariff-grid');form.append(g);return g;}
  let g=section('1. Route & week');
  for(const [key,label,type,opts] of [['origin','Origin','text'],['destination','Destination','text'],['product','Product','text',tariffProducts],['label','Customer service name','text'],['validFrom','Valid from (cargo ready)','date'],['validTo','Valid through','date'],['currency','Currency','text',{USD:'USD',AED:'AED',CNY:'CNY',EUR:'EUR',GBP:'GBP'}]]) fields[key]=tariffField(g,key,label,r[key]||(key==='label'?tariffProducts[r.product]:''),type,opts);
  g=section('2. Buying cost & markup');
  fields.buyRate=tariffField(g,'buyRate','Buying cost per chargeable unit',r.buyRate,'number');fields.markupType=tariffField(g,'markupType','Markup method',r.markupType,'text',{percent:'Percentage added to buying cost',fixed:'Fixed amount added per unit'});fields.markup=tariffField(g,'markup','Markup',r.markup,'number');
  const sell=element('p',undefined,'selling-preview wide');g.append(sell);
  const updateSell=()=>{const buy=Number(fields.buyRate.value),m=Number(fields.markup.value),total=fields.markupType.value==='percent'?buy*(1+m/100):buy+m;sell.textContent='Customer selling rate: '+priceText(Math.round(total*100)/100,fields.currency.value)+' per chargeable unit';};
  for(const k of ['buyRate','markup','markupType','currency'])fields[k].addEventListener('input',updateSell);updateSell();
  g=section('3. Charging & cargo rules');
  fields.basis=tariffField(g,'basis','Chargeable quantity',r.basis,'text',{container:'Per container',wm:'Higher of CBM or weight ÷ kg/CBM',cbm:'CBM only',actual_kg:'Actual kilograms',volumetric_kg:'Higher of actual or volumetric kg'});
  for(const [key,label,help] of [['kgPerCbm','Kilograms per CBM','Sea shared cargo: 475. Trucks: select 300 or 350 to match your tariff.'],['volumetricDivisor','Air volumetric divisor','Volume in cm³ ÷ divisor; default 6000.'],['minimumUnits','Minimum chargeable quantity','Applied before rounding.'],['rounding','Round quantity up to','For example 0.01 CBM or 1 kg.'],['minimumCharge','Minimum freight charge','In the selected currency.'],['maxWeight','Maximum gross weight (kg)','For FCL: per container. Other services: per shipment. Enter the approved operational limit.'],['maxCbm','Maximum shipment CBM','Not applied to full containers.'],['maxDensity','Maximum density (kg/CBM)','0 means no additional density limit. This is separate from the charging conversion.']])fields[key]=tariffField(g,key,label,r[key],'number',null,help);
  function productChanged(){const p=fields.product.value;fields.label.value=tariffProducts[p];fields.basis.value=p.startsWith('FCL')?'container':p.startsWith('AIR')?'volumetric_kg':'wm';fields.kgPerCbm.value=p==='ROAD_LTL'?350:475;fields.rounding.value=p.startsWith('AIR')?1:.01;fields.minimumUnits.value=1;}
  fields.product.addEventListener('change',productChanged);
  g=section('4. Extra customer charges');g.append(element('p','These are selling charges per shipment, added after freight. Use 0 when included in your unit price.','helper wide'));
  for(const [key,label] of [['originFee','Origin charges'],['destinationFee','Destination charges'],['documentationFee','Documentation']])fields[key]=tariffField(g,key,label,r[key],'number');
  g=section('5. Scope & conditions');
  for(const [key,label] of [['inclusions','Included in this estimate'],['exclusions','Excluded / payable separately'],['deliveryArea','DDP delivery area / postcode limits'],['publicNotes','Customer conditions'],['internalNotes','Private purchasing notes — never shown to customers']])fields[key]=tariffField(g,key,label,r[key]||'','textarea');
  const ddp=element('label',undefined,'check-row');const ddpCheck=element('input');ddpCheck.type='checkbox';ddpCheck.checked=!!r.ddpConfirmed;ddp.append(ddpCheck,document.createTextNode('DDP delivery coverage and duties/tax treatment are confirmed and described above.'));form.append(ddp);
  g=section('6. Booking acceptance');fields.bookingMode=tariffField(g,'bookingMode','When a customer books',r.bookingMode,'text',{review:'Staff confirmation required',auto:'Automatically accept eligible UKR bookings'});fields.responseMinutes=tariffField(g,'responseMinutes','Confirmation target (minutes)',r.responseMinutes,'number',null,'Staff requests show a due time. Overdue requests are flagged; the timer never accepts a booking by itself.');
  form.append(element('p','Special handling, out-of-limit cargo and unconfirmed door delivery always require staff review. Automatic acceptance records a UKR booking; it does not reserve space with a carrier.','notice'));
  const pub=element('label',undefined,'check-row');const pubCheck=element('input');pubCheck.type='checkbox';pubCheck.checked=!!r.published;pub.append(pubCheck,document.createTextNode('Publish this rate to customers for its valid dates'));form.append(pub);
  const err=element('p',undefined,'error');err.setAttribute('role','alert');const save=element('button','Save rate','primary');save.type='submit';form.append(err,save);
  form.addEventListener('submit',async e=>{e.preventDefault();err.textContent='';save.disabled=true;try{const payload=Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.value]));payload.published=pubCheck.checked;payload.ddpConfirmed=ddpCheck.checked;payload.version=r.version;await api(r.id?'/rates/'+r.id:'/rates',r.id?'PATCH':'POST',payload);$('appSuccess').textContent=payload.published?'Rate saved and published. The website will use it on the next search.':'Draft rate saved. It is not visible to customers.';await ratesPage();}catch(e){err.textContent=e.message;}finally{save.disabled=false;}});content.append(form);
}
async function bookingsPage() {
  const content=page('Website bookings'),result=await api('/website-bookings');
  const intro=panel('Customer requests, connected to your website','Every record includes the submitted cargo, contact details and the selling-price calculation captured at submission. Accepted bookings have an immutable UKR shipment reference.');intro.append(button('Refresh bookings',bookingsPage));content.append(intro);
  if(!result.bookings.length){content.append(element('p','No website bookings yet. New customer requests will appear here.','empty'));return;}
  for(const b of result.bookings){const d=b.data.details,c=b.data.cargo,card=element('article',undefined,'panel booking-card'),head=element('div',undefined,'tariff-card-head');head.append(element('h2',b.reference),element('span',b.status,'pill'));card.append(head,element('h3',`${c.origin} → ${c.destination}`),element('p',`${b.data.service} · ${c.weight} kg · ${c.cargoType==='container'?c.containers+' × '+c.containerSize:c.cbm+' CBM'} · Ready ${c.ready}`));
    if(b.shipmentReference)card.append(element('p','Shipment: '+b.shipmentReference,'notice'));
    card.append(element('p',`${d.contactName} · ${d.company||'Individual'} · ${d.contactEmail} · ${d.contactPhone||'No phone'}`),element('p',`${d.commodity} · ${d.packages} packages`));
    if(['requested','reviewing'].includes(b.status))card.append(element('p',`${Date.now()>b.responseDue?'OVERDUE — ':''}Confirmation target: ${new Date(b.responseDue).toLocaleString()}`,Date.now()>b.responseDue?'error':'notice'));
    if(b.estimate?.total!=null)card.append(element('strong',priceText(b.estimate.total,b.estimate.currency)+' · estimate at booking'),element('p',b.estimate.formula,'helper'));
    else card.append(element('strong','Price requires staff quotation'));
    const more=element('details');more.append(element('summary','Cargo, charges & conditions'));for(const [label,value] of [['Dimensions',d.dimensions],['Pickup',d.pickupAddress],['Delivery',d.deliveryAddress],['Notes',d.cargoNotes],['Stackable',d.stackable?'Yes':'No'],['Batteries',d.batteries?'Yes':'No'],['Dangerous goods',d.dangerous?'Yes':'No'],['Oversized',d.oversized?'Yes':'No'],['Included',b.estimate?.inclusions],['Excluded',b.estimate?.exclusions]])if(value)more.append(element('p',label+': '+value));for(const charge of b.estimate?.charges||[])more.append(element('p',charge.label+': '+priceText(charge.amount,b.estimate.currency)));card.append(more);
    const transitions={requested:['reviewing','accepted','declined','cancelled'],reviewing:['accepted','declined','cancelled'],accepted:['cancelled'],declined:[],cancelled:[]};
    if(me.canManageBookings&&transitions[b.status].length){const actions=element('div',undefined,'tariff-actions'),select=element('select');select.setAttribute('aria-label','New status for '+b.reference);for(const status of transitions[b.status]){const o=element('option',({reviewing:'Start review',accepted:'Accept UKR booking',declined:'Decline request',cancelled:'Cancel booking'})[status]);o.value=status;select.append(o);}actions.append(select,button('Update status',async()=>{await api('/website-bookings/'+b.id,'PATCH',{status:select.value,version:b.version});await bookingsPage();$('appSuccess').textContent='Booking updated. The original estimate is retained.';},'primary'));card.append(actions);}content.append(card);
  }
}
