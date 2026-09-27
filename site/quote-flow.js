'use strict';
const R = window.UKRRules;
const $ = id => document.getElementById(id);
const DRAFT_KEY = 'ukr.request-drafts.v1';
let mode = 'compare';
let searchState = null;
let selectedOffer = null;
let requestDetails = null;
let draftId = null;
let drafts = [];
let searchRevision = 0, bookingKey = null;
const PUBLIC_API = location.hostname === '127.0.0.1' || location.hostname === 'localhost' ? 'http://127.0.0.1:4180/api/public' : 'https://ukr-staff-staging.onrender.com/api/public';
async function publicRequest(path,data) {
  const response=await fetch(PUBLIC_API+path,{method:data?'POST':'GET',credentials:'omit',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(65000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Request could not be completed.');return result;
}
const offerMoney = offer => offer.total == null ? 'Staff quotation required' : new Intl.NumberFormat('en',{style:'currency',currency:offer.currency}).format(offer.total);
const textFields = ['commodity', 'packages', 'declaredValue', 'dimensions', 'pickupAddress', 'deliveryAddress', 'cargoNotes', 'contactName', 'company', 'contactEmail', 'contactPhone'];
const flagFields = ['stackable', 'batteries', 'dangerous', 'oversized'];
const handlingFlags = details => Object.fromEntries(flagFields.map(key => [key,details[key]]));
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function show(id, visible = true) { $(id).classList.toggle('hidden', !visible); }
function jump(id) {
  $(id).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
function error(id, message) { $(id).textContent = message; }
function money(value) { return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
function clearSelection() {
  selectedOffer = null; requestDetails = null; draftId = null;
  bookingKey = null; show('bookingReceipt',false); $('submitBooking').disabled=false; $('submitBooking').textContent='Submit booking request';
  show('quoteFlow', false); show('savedNotice', false);
}
function invalidateSearch() {
  searchRevision++;
  searchState = null;
  clearSelection();
  show('results', false);
}
function setMode(value) {
  const container = $('cargoType').value === 'container';
  mode = container && ['air', 'compare'].includes(value) ? 'sea' : value;
  document.querySelectorAll('.mode').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  $('modeNotice').textContent = container ? 'Full container selected. Choose sea or road; air and sea comparison is for loose cargo.' : '';
}
function chooseMode(button) { invalidateSearch(); setMode(button.dataset.mode); }
function cargoChanged() {
  invalidateSearch();
  const container = $('cargoType').value === 'container';
  show('containerFields', container);
  $('cbm').disabled = container;
  setMode(mode);
}
function swapRoute() {
  const origin = $('origin').value;
  $('origin').value = $('destination').value; $('destination').value = origin;
  invalidateSearch();
}
function scrollBook() { jump('book'); }
function newRequest() {
  invalidateSearch();
  $('quoteDetails').reset();
  error('searchError', ''); error('detailsError', ''); error('draftError', '');
  scrollBook();
}
function editSearch() { invalidateSearch(); scrollBook(); }
function prefill(value) { invalidateSearch(); setMode(value); scrollBook(); }
function readSearch() {
  return { origin: $('origin').value.trim(), destination: $('destination').value.trim(), ready: $('ready').value,
    weight: $('weight').value, cbm: $('cbm').value, cargoType: $('cargoType').value, mode,
    containerSize: $('containerSize').value, containers: $('containers').value,
    ddp: $('ddp').checked, flex: $('flex').checked };
}
function cargoSummary(s) {
  return s.cargoType === 'container' ? `${s.containers} × ${s.containerSize} · ${Number(s.weight).toLocaleString()} kg total` : `${Number(s.weight).toLocaleString()} kg · ${Number(s.cbm).toLocaleString()} CBM · ${s.cargoType}`;
}
function searchOptions() {
  const input = readSearch();
  const problem = R.validateSearch(input);
  error('searchError', problem);
  if (problem) { invalidateSearch(); return; }
  clearSelection();
  searchState = input;
  $('resultScope').value = input.ddp ? 'door' : 'terminal';
  renderOptions(); show('results'); jump('results');
}
function renderOptions() {
  return loadRateOptions().catch(e=>error('searchError',e.message));
}
async function loadRateOptions() {
  if (!searchState) return;
  const revision=++searchRevision, searched={...searchState};
  $('searchSummary').textContent = `${searchState.origin} → ${searchState.destination} · ${cargoSummary(searchState)} · Ready ${searchState.ready}`;
  $('optionCards').replaceChildren(node('p','Checking published weekly rates… The first request may take up to a minute.','empty-state'));
  let live=[];
  try {live=(await publicRequest('/estimate',{search:searched})).offers;}catch(e){if(revision!==searchRevision)return;$('optionCards').replaceChildren(node('p','Live rates are unavailable. Please try your search again. '+e.message,'inline-error'));return;}
  if(revision!==searchRevision)return;
  const offers=live.map(o=>({...o,id:'rate-'+o.rateId,description:o.scope,icon:o.product.startsWith('AIR')?'✈':o.product==='ROAD_LTL'?'▤':'▰',priority:o.product.startsWith('AIR')?1:2}));
  const fallback=R.options(searched).filter(o=>!live.some(r=>o.id==='air'?r.product.startsWith('AIR'):o.id==='road'?r.product==='ROAD_LTL':r.product.startsWith('LCL')||r.product.startsWith('FCL')));
  offers.push(...fallback);
  if ($('resultPriority').value === 'speed') offers.sort((a, b) => a.priority - b.priority);
  if ($('resultPriority').value === 'flex') offers.sort((a, b) => b.priority - a.priority);
  $('optionCards').replaceChildren();
  for (const offer of offers) {
    const article = node('article', undefined, 'option-card');
    const title = node('div', undefined, 'option-title');
    const copy = node('div'); copy.append(node('h3', offer.title), node('p', offer.description));
    title.append(node('div', offer.icon, 'transport-icon'), copy);
    const availability = node('div', undefined, 'option-meta'); availability.append(node('b',offer.rateId?'Weekly tariff':'Request only'),node('span',offer.rateId?`Cargo ready: ${offer.validFrom} – ${offer.validTo}`:'No published tariff for this route/date'));
    const price = node('div', undefined, 'option-price'); price.append(node('b',offer.rateId?offerMoney(offer):'Quotation required'),node('span',offer.rateId?`${offer.quantity} ${offer.unit} · ${offer.bookingMode==='auto'?'Eligible bookings accepted automatically':`Confirmation target ${offer.responseMinutes} min`}`:'UKR will prepare a quotation'));
    const button = node('button', 'Continue →', 'select-btn');
    button.setAttribute('aria-label', `Continue with ${offer.title}`);
    button.addEventListener('click', () => selectOffer(offer));
    const details = node('details');
    details.append(node('summary',offer.rateId?'Calculation & inclusions':'What needs confirmation?'));
    if(offer.rateId){details.append(node('p',offer.formula+` · Minimum ${offer.minimumUnits} · Rounded up to ${offer.rounding} ${offer.unit}`));for(const line of offer.charges)details.append(node('p',`${line.label}: ${new Intl.NumberFormat('en',{style:'currency',currency:offer.currency}).format(line.amount)}`));details.append(node('p','Included: '+offer.inclusions),node('p','Excluded: '+offer.exclusions));if(offer.deliveryArea)details.append(node('p','Delivery area: '+offer.deliveryArea));if(offer.notes)details.append(node('p',offer.notes));for(const reason of offer.reasons)details.append(node('p',reason));}
    details.append(node('p','Final cargo measurements and carrier allocation require verification. A UKR booking is separate from carrier confirmation.'));
    if(searchState.ddp&&!offer.product?.endsWith('DDP'))details.append(node('p','Door delivery requested: this tariff is not a DDP/door quote. Additional scope requires staff confirmation.'));
    article.append(title, availability, price, button, details);
    $('optionCards').append(article);
  }
}
function updateScope() {
  if (!searchState) return;
  searchState.ddp = $('resultScope').value === 'door';
  $('ddp').checked = searchState.ddp;
  clearSelection(); renderOptions();
}
function selectOffer(offer) {
  // Capture the search that produced the results, never partially edited inputs.
  if (!searchState || R.validateSearch(searchState)) { error('searchError', 'Search again with a current cargo-ready date.'); scrollBook(); return; }
  selectedOffer = { ...offer }; requestDetails = null; draftId = null;
  bookingKey=null;show('bookingReceipt',false);$('submitBooking').disabled=false;$('submitBooking').textContent='Submit booking request';
  show('savedNotice', false); error('draftError', '');
  $('selectedService').textContent = offer.title;
  $('selectedRoute').textContent = `${searchState.origin} → ${searchState.destination}`;
  $('selectedCargo').textContent = cargoSummary(searchState);
  $('selectedReady').textContent = `Ready ${searchState.ready} · ${searchState.ddp ? 'Door delivery requested' : 'Terminal service requested'}`;
  updatePriceSummary();
  editDetails();
}
function openServiceInquiry(kind) {
  const input = readSearch();
  const problem = R.validateSearch(input);
  error('searchError', problem);
  if (problem) { scrollBook(); return; }
  searchState = input;
  const offer = kind === 'customs' ? { id: 'customs', title: 'Customs Clearance', description: 'Document and clearance review', status: 'REQUEST_ONLY' } : { id: 'china', title: 'China Operations', description: 'Pickup, warehouse and consolidation inquiry', status: 'REQUEST_ONLY' };
  selectOffer(offer);
}
function backToOptions() {
  clearSelection();
  if (searchState) { renderOptions(); show('results'); jump('results'); } else scrollBook();
}
function editDetails() {
  show('quoteFlow'); show('quoteDetails'); show('quoteReview', false);
  $('flowHeading').textContent = 'Tell us about your cargo';
  $('detailsStep').setAttribute('aria-current', 'step'); $('reviewStep').removeAttribute('aria-current');
  jump('quoteFlow'); $('flowHeading').focus({ preventScroll: true });
}
function collectDetails() {
  const details = { scope: searchState.ddp ? 'door' : 'terminal' };
  textFields.forEach(id => { details[id] = $(id).value.trim(); });
  flagFields.forEach(id => { details[id] = $(id).checked; });
  details.consent=$('bookingConsent').checked;
  return details;
}
function validDetails(d) {
  return d && textFields.every(k => typeof d[k] === 'string' && d[k].length <= (k === 'cargoNotes' ? 1500 : 500)) && flagFields.every(k => typeof d[k] === 'boolean') && d.commodity.trim() && d.contactName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail) && Number.isInteger(Number(d.packages)) && Number(d.packages) > 0 && Number(d.packages) <= 1000000 && (d.declaredValue === '' || (Number.isFinite(Number(d.declaredValue)) && Number(d.declaredValue) >= 0 && Number(d.declaredValue) <= 1e9));
}
async function reviewRequest(event) {
  event.preventDefault();
  if (!searchState || !selectedOffer) { scrollBook(); return; }
  error('detailsError', '');
  if (!$('quoteDetails').reportValidity()) { error('detailsError', 'Complete the required cargo and contact fields.'); return; }
  const details = collectDetails();
  if (!validDetails(details)) { error('detailsError', 'Enter a commodity, contact name, valid email and whole package quantity.'); return; }
  requestDetails = details;
  bookingKey=null;show('bookingReceipt',false);$('submitBooking').disabled=false;$('submitBooking').textContent='Submit booking request';
  if(selectedOffer.rateId){try{const latest=(await publicRequest('/estimate',{search:searchState,details:handlingFlags(details)})).offers.find(o=>o.rateId===selectedOffer.rateId);if(!latest){error('detailsError','This rate is no longer available. Search again for the current week.');return;}selectedOffer={...selectedOffer,...latest};updatePriceSummary();}catch(e){error('detailsError',e.message);return;}}
  showReview();
}
function updatePriceSummary(){const s=$('selectedPrice');s.replaceChildren(node('strong',selectedOffer.rateId?offerMoney(selectedOffer):'Quotation required'));if(selectedOffer.rateId){s.append(node('span',`${selectedOffer.quantity} ${selectedOffer.unit} · Valid through ${selectedOffer.validTo}`));for(const line of selectedOffer.charges)s.append(node('p',`${line.label}: ${new Intl.NumberFormat('en',{style:'currency',currency:selectedOffer.currency}).format(line.amount)}`));}s.append(node('p',selectedOffer.rateId?selectedOffer.scope:'Staff will confirm scope and charges.'));}
async function submitBooking(){
  if(!selectedOffer||!requestDetails||!searchState)return;
  error('draftError','');if(!$('bookingConsent').checked){error('draftError','Please agree to send your request and contact details to UKR.');return;}
  $('submitBooking').disabled=true;$('submitBooking').textContent='Sending request…';bookingKey ||= crypto.randomUUID();
  try{const result=await publicRequest('/bookings',{search:searchState,details:{...requestDetails,consent:true},rateId:selectedOffer.rateId||null,rateVersion:selectedOffer.rateVersion||null,service:selectedOffer.title,requestKey:bookingKey,website:$('websiteContact').value});
    const receipt=$('bookingReceipt');receipt.replaceChildren(node('h3',result.status==='accepted'?'UKR booking accepted':'Booking request received'),node('strong',result.reference),node('p',result.message));if(result.shipmentReference)receipt.append(node('p','Shipment reference: '+result.shipmentReference));else receipt.append(node('p','Confirmation target: '+new Date(result.responseDue).toLocaleString()));if(result.estimate?.total!=null)receipt.append(node('p','Recorded estimate: '+offerMoney(result.estimate)));receipt.append(node('p','Keep this reference. This confirmation is saved in the UKR staff dashboard. No payment has been taken.'));show('bookingReceipt');receipt.scrollIntoView({block:'center',behavior:'smooth'});$('submitBooking').textContent='Request received';
  }catch(e){error('draftError',e.message);$('submitBooking').disabled=false;$('submitBooking').textContent='Submit booking request';}
}
function addReviewGroup(title, entries) {
  const group = node('div', undefined, 'review-group');
  const list = node('dl', undefined, 'review-list');
  for (const [label, value] of entries) { list.append(node('dt', label), node('dd', value === '' ? 'Not provided' : String(value))); }
  group.append(node('h3', title), list); $('reviewContent').append(group);
}
function showReview() {
  const s = searchState, d = requestDetails;
  $('reviewContent').replaceChildren();
  addReviewGroup('Route & service', [['Service', selectedOffer.title], ['Route', `${s.origin} → ${s.destination}`], ['Cargo ready', s.ready], ['Cargo', cargoSummary(s)], ['Delivery scope',selectedOffer.scope || (s.ddp ? 'Door delivery requested' : 'Port / airport / terminal')], ['Flexible date', s.flex ? 'Yes' : 'No'], ['Estimate',selectedOffer.rateId?offerMoney(selectedOffer):'Awaiting UKR quotation'],['Booking',selectedOffer.bookingMode==='auto'&&selectedOffer.status==='ESTIMATE'&&(!s.ddp||selectedOffer.product?.endsWith('DDP'))?'Automatic UKR acceptance for declared eligible cargo':`Staff confirmation target: ${selectedOffer.responseMinutes||60} minutes`]]);
  if(selectedOffer.rateId){addReviewGroup('Calculation & tariff terms',[['Calculation',selectedOffer.formula],['Chargeable quantity',selectedOffer.quantity+' '+selectedOffer.unit],['Included',selectedOffer.inclusions],['Excluded',selectedOffer.exclusions],['Delivery area',selectedOffer.deliveryArea||'See service scope'],['Conditions',selectedOffer.notes||selectedOffer.notice]]);}
  addReviewGroup('Cargo & handling', [['Commodity', d.commodity], ['Packages', d.packages], ['Declared value', d.declaredValue === '' ? 'Not provided' : money(Number(d.declaredValue))], ['Dimensions', d.dimensions], ['Stackable', d.stackable ? 'Yes' : 'No'], ['Batteries', d.batteries ? 'Yes' : 'No'], ['Dangerous goods', d.dangerous ? 'Yes' : 'No'], ['Heavy / oversized', d.oversized ? 'Yes' : 'No'], ['Pickup', d.pickupAddress], ['Delivery', d.deliveryAddress], ['Notes', d.cargoNotes]]);
  addReviewGroup('Contact', [['Name', d.contactName], ['Company', d.company], ['Email', d.contactEmail], ['Phone / WhatsApp', d.contactPhone]]);
  const flags = R.reviewFlags(d);
  if (flags.length) { const list = node('ul', undefined, 'review-flags'); flags.forEach(flag => list.append(node('li', flag))); $('reviewContent').append(node('h3', 'Operations review required'), list); }
  show('quoteDetails', false); show('quoteReview'); show('quoteFlow');
  $('flowHeading').textContent = 'Review your request';
  $('reviewStep').setAttribute('aria-current', 'step'); $('detailsStep').removeAttribute('aria-current');
  jump('quoteFlow'); $('flowHeading').focus({ preventScroll: true });
}
function validDraft(draft) {
  if (!draft || draft.version !== 1 || typeof draft.id !== 'string' || !/^DRAFT-[\w-]{1,60}$/.test(draft.id) || typeof draft.updatedAt !== 'string' || !draft.search || !validDetails(draft.details)) return false;
  const s = draft.search;
  if (!['origin', 'destination', 'ready'].every(k => typeof s[k] === 'string') || typeof s.ddp !== 'boolean' || typeof s.flex !== 'boolean' || R.validateSearch(s, '2000-01-01')) return false;
  return typeof draft.offerId === 'string' && ([...R.options(s).map(o => o.id), 'customs', 'china'].includes(draft.offerId) || /^rate-[a-f0-9-]{36}$/.test(draft.offerId));
}
function loadDrafts() {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed) || !parsed.every(validDraft)) throw new Error('Invalid draft data');
    drafts = parsed.slice(0, 20);
  } catch { drafts = []; error('draftListError', 'Saved drafts could not be read. You can still prepare and print a new request.'); }
  renderDrafts();
}
function saveDraft() {
  if (!requestDetails || !selectedOffer || !searchState) return;
  error('draftError', '');
  const id = draftId || `DRAFT-${crypto.randomUUID()}`;
  const record = { version: 1, id, updatedAt: new Date().toISOString(), search: { ...searchState }, offerId: selectedOffer.id, details: { ...requestDetails } };
  if (!validDraft(record)) { error('draftError', 'Review the request details before saving.'); return; }
  if (!draftId && drafts.length >= 20) { error('draftError', 'You have 20 saved drafts. Remove an older draft before saving another.'); return; }
  const next = [record, ...drafts.filter(d => d.id !== id)];
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); }
  catch { error('draftError', 'This browser could not save the draft. Your review is still available to print.'); return; }
  draftId = id; drafts = next; renderDrafts();
  $('savedNotice').textContent = 'Draft saved in this browser. It has not been sent to UKR and is not a booking.'; show('savedNotice');
}
function renderDrafts() {
  $('draftList').replaceChildren();
  if (!drafts.length) { $('draftList').append(node('p', 'No saved drafts yet. Choose a service above to prepare your first request.', 'empty-state')); return; }
  for (const draft of drafts) {
    const card = node('article', undefined, 'draft-card');
    card.append(node('span', 'Local draft · Not sent', 'draft-status'), node('h3', `${draft.search.origin} → ${draft.search.destination}`), node('p', `${draft.details.commodity} · ${cargoSummary(draft.search)}`));
    const open = node('button', 'Open draft', 'secondary-btn'); open.addEventListener('click', () => openDraft(draft.id));
    const remove = node('button', 'Remove draft', 'secondary-btn'); remove.addEventListener('click', () => removeDraft(draft.id));
    card.append(open, remove); $('draftList').append(card);
  }
}
async function openDraft(id) {
  const draft = drafts.find(d => d.id === id); if (!draft) return;
  const s = draft.search;
  ['origin', 'destination', 'ready', 'weight', 'cbm', 'cargoType', 'containerSize', 'containers'].forEach(key => { $(key).value = s[key] ?? ''; });
  $('ddp').checked = s.ddp; $('flex').checked = s.flex;
  cargoChanged(); setMode(s.mode); searchState = { ...s };
  if (R.validateSearch(searchState)) { error('searchError', 'This draft needs an updated cargo-ready date. Update the search and choose a service again; cargo details are retained.'); }
  textFields.forEach(key => { $(key).value = draft.details[key]; });
  flagFields.forEach(key => { $(key).checked = draft.details[key]; });
  if (R.validateSearch(searchState)) { scrollBook(); return; }
  if (['customs', 'china'].includes(draft.offerId)) openServiceInquiry(draft.offerId);
  else if(draft.offerId.startsWith('rate-')){try{const offer=(await publicRequest('/estimate',{search:searchState,details:handlingFlags(draft.details)})).offers.find(o=>'rate-'+o.rateId===draft.offerId);if(!offer){error('draftListError','The saved rate expired or changed. Search again for an available tariff.');scrollBook();return;}selectOffer({...offer,id:draft.offerId});}catch(e){error('draftListError',e.message);return;}}
  else selectOffer(R.options(searchState).find(o => o.id === draft.offerId));
  draftId = id; requestDetails = { ...draft.details }; showReview();
}
function removeDraft(id) {
  const next = drafts.filter(d => d.id !== id);
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); }
  catch { error('draftListError', 'This browser could not remove the draft.'); return; }
  drafts = next; if (draftId === id) { draftId = null; show('savedNotice', false); } renderDrafts();
}
function calculateMargin() {
  try {
    const result = R.margin($('productCost').value, $('quantity').value, $('shippingCost').value, $('targetMargin').value);
    $('calcResult').replaceChildren(node('span', 'Estimated landed cost / unit'), node('b', money(result.landed)), node('span', 'Suggested selling price'), node('strong', money(result.selling)));
    error('calcError', '');
  } catch (problem) { error('calcError', problem.message); }
}
function showPortal() { show('portalPreview'); jump('portalPreview'); }
function hidePortal() { show('portalPreview', false); }
function trackShipment() {
  const id = $('trackId').value.trim().toUpperCase();
  const problem = id === 'UKR-260184' ? '' : 'This preview contains only sample shipment UKR-260184. Live tracking is not connected yet.';
  error('trackError', problem);
  if (problem) { hidePortal(); return; }
  showPortal();
}
const ready = new Date(); ready.setDate(ready.getDate() + 2);
$('ready').min = R.localDate(); $('ready').value = R.localDate(ready);
$('quoteDetails').addEventListener('submit', reviewRequest);
['origin', 'destination', 'ready', 'weight', 'cbm', 'containerSize', 'containers', 'ddp', 'flex'].forEach(id => $(id).addEventListener('input', invalidateSearch));
$('quoteDetails').addEventListener('input', () => { show('savedNotice', false); });
loadDrafts();
publicRequest('/catalog').then(data=>{const places=new Set([...$('places').options].map(o=>o.value));for(const route of data.routes)for(const location of [route.origin,route.destination])if(!places.has(location)){const option=node('option');option.value=location;$('places').append(option);places.add(location);}}).catch(()=>{});
