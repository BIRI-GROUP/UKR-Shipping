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
const textFields = ['commodity', 'packages', 'declaredValue', 'dimensions', 'pickupAddress', 'deliveryAddress', 'cargoNotes', 'contactName', 'company', 'contactEmail', 'contactPhone'];
const flagFields = ['stackable', 'batteries', 'dangerous', 'oversized'];
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
  show('quoteFlow', false); show('savedNotice', false);
}
function invalidateSearch() {
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
  if (!searchState) return;
  $('searchSummary').textContent = `${searchState.origin} → ${searchState.destination} · ${cargoSummary(searchState)} · Ready ${searchState.ready}`;
  const offers = R.options(searchState);
  if ($('resultPriority').value === 'speed') offers.sort((a, b) => a.priority - b.priority);
  if ($('resultPriority').value === 'flex') offers.sort((a, b) => b.priority - a.priority);
  $('optionCards').replaceChildren();
  for (const offer of offers) {
    const article = node('article', undefined, 'option-card');
    const title = node('div', undefined, 'option-title');
    const copy = node('div'); copy.append(node('h3', offer.title), node('p', offer.description));
    title.append(node('div', offer.icon, 'transport-icon'), copy);
    const availability = node('div', undefined, 'option-meta'); availability.append(node('b', 'Request only'), node('span', 'Availability to confirm'));
    const price = node('div', undefined, 'option-price'); price.append(node('b', 'Quotation required'), node('span', 'No live rate connected'));
    const button = node('button', 'Continue →', 'select-btn');
    button.setAttribute('aria-label', `Continue with ${offer.title}`);
    button.addEventListener('click', () => selectOffer(offer));
    const details = node('details');
    details.append(node('summary', 'What needs confirmation?'), node('p', 'UKR must confirm the route, cargo acceptance, available capacity, chargeable weight, departure and transit time.'));
    details.append(node('p', searchState.ddp ? 'Door delivery requested. The formal quote must state whether clearance, duties, taxes, local handling and final delivery are included.' : 'Terminal service requested. Pickup, delivery, customs and local charges must be agreed separately.'));
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
  show('savedNotice', false); error('draftError', '');
  $('selectedService').textContent = offer.title;
  $('selectedRoute').textContent = `${searchState.origin} → ${searchState.destination}`;
  $('selectedCargo').textContent = cargoSummary(searchState);
  $('selectedReady').textContent = `Ready ${searchState.ready} · ${searchState.ddp ? 'Door delivery requested' : 'Terminal service requested'}`;
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
  return details;
}
function validDetails(d) {
  return d && textFields.every(k => typeof d[k] === 'string' && d[k].length <= (k === 'cargoNotes' ? 1500 : 500)) && flagFields.every(k => typeof d[k] === 'boolean') && d.commodity.trim() && d.contactName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail) && Number.isInteger(Number(d.packages)) && Number(d.packages) > 0 && Number(d.packages) <= 1000000 && (d.declaredValue === '' || (Number.isFinite(Number(d.declaredValue)) && Number(d.declaredValue) >= 0 && Number(d.declaredValue) <= 1e9));
}
function reviewRequest(event) {
  event.preventDefault();
  if (!searchState || !selectedOffer) { scrollBook(); return; }
  error('detailsError', '');
  if (!$('quoteDetails').reportValidity()) { error('detailsError', 'Complete the required cargo and contact fields.'); return; }
  const details = collectDetails();
  if (!validDetails(details)) { error('detailsError', 'Enter a commodity, contact name, valid email and whole package quantity.'); return; }
  requestDetails = details;
  showReview();
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
  addReviewGroup('Route & service', [['Service', selectedOffer.title], ['Route', `${s.origin} → ${s.destination}`], ['Cargo ready', s.ready], ['Cargo', cargoSummary(s)], ['Delivery scope', s.ddp ? 'Door delivery requested' : 'Port / airport / terminal'], ['Flexible date', s.flex ? 'Yes' : 'No'], ['Price & timing', 'Awaiting UKR quotation; no booking confirmed']]);
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
  return typeof draft.offerId === 'string' && [...R.options(s).map(o => o.id), 'customs', 'china'].includes(draft.offerId);
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
function openDraft(id) {
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
