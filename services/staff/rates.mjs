// Customer-facing totals are always calculated here, never accepted from a browser.
export const products = Object.freeze({ FCL20: 'Sea · 20′ container', FCL40: 'Sea · 40′ container', FCL40HC: 'Sea · 40′ high cube', LCL: 'Sea · LCL', LCL_DDP: 'Sea · LCL DDP', AIR: 'Air cargo', AIR_DDP: 'Air · DDP', ROAD_LTL: 'Road · Shared truck' });
export const currencies = ['AED', 'USD', 'CNY', 'EUR', 'GBP'];
const bad = message => { const e = new Error(message); e.status = 400; throw e; };
export const today = () => new Date().toISOString().slice(0, 10);
export const routeKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const str = (v, max, required = false) => { if (typeof v !== 'string' || v.length > max || (required && !v.trim())) bad('Complete the required text fields within their length limits.'); return v.trim(); };
function num(v, min, max, label) { if (v === '' || v === null || typeof v === 'boolean' || !['number','string'].includes(typeof v) || !Number.isFinite(Number(v)) || Number(v) < min || Number(v) > max) bad('Enter a valid ' + label + '.'); return Number(v); }
const date = v => { const parsed=new Date(String(v)+'T12:00:00Z');if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==v)bad('Choose valid rate dates.');return v; };
export function validateRate(input) {
  const r = {};
  r.origin = str(input.origin,120,true); r.destination = str(input.destination,120,true);
  if (routeKey(r.origin) === routeKey(r.destination)) bad('Origin and destination must differ.');
  if (!Object.hasOwn(products,input.product)) bad('Choose a shipping product.'); r.product = input.product;
  r.label = str(input.label || products[r.product],120,true);
  r.validFrom = date(input.validFrom); r.validTo = date(input.validTo);
  if (r.validTo < r.validFrom) bad('End date must be on or after the start date.');
  if (!currencies.includes(input.currency)) bad('Choose a supported currency.'); r.currency = input.currency;
  r.published = input.published === true;
  if (r.published && r.validTo < today()) bad('An expired rate cannot be published.');
  const fcl = r.product.startsWith('FCL'), air = r.product.startsWith('AIR');
  r.basis = input.basis;
  if (!(fcl ? ['container'] : air ? ['volumetric_kg'] : ['wm','cbm','actual_kg','volumetric_kg']).includes(r.basis)) bad('Choose a calculation basis suitable for this product.');
  r.buyRate = num(input.buyRate,0.01,1000000,'buying rate');
  r.markupType = input.markupType;
  if (!['percent','fixed'].includes(r.markupType)) bad('Choose percentage markup or a fixed markup per chargeable unit.');
  r.markup = num(input.markup,0,1000000,'markup');
  r.unitPrice = Math.round((r.markupType === 'percent' ? r.buyRate*(1+r.markup/100) : r.buyRate+r.markup)*100)/100;
  if (Math.abs(r.unitPrice * 100 - Math.round(r.unitPrice * 100)) > 0.00001) bad('Use at most two decimal places for money.');
  for (const k of ['minimumCharge','originFee','destinationFee','documentationFee']) { r[k] = num(input[k] ?? 0,0,1000000,k); if (Math.abs(r[k]*100-Math.round(r[k]*100))>0.00001) bad('Use at most two decimal places for money.'); }
  r.minimumUnits = fcl ? 1 : num(input.minimumUnits,0.01,100000,'minimum chargeable quantity');
  r.rounding = fcl ? 1 : num(input.rounding,0.01,1000,'rounding increment');
  r.kgPerCbm = num(input.kgPerCbm ?? (r.product === 'ROAD_LTL' ? 350 : 475),1,10000,'kilograms per CBM');
  r.volumetricDivisor = num(input.volumetricDivisor ?? 6000,1000,10000,'air volumetric divisor');
  r.maxWeight = num(input.maxWeight ?? 1000000,0.01,10000000,'maximum shipment weight');
  r.maxCbm = num(input.maxCbm ?? 1000,0.01,100000,'maximum CBM');
  r.maxDensity = num(input.maxDensity ?? 0,0,100000,'maximum density (zero means no limit)');
  r.inclusions = str(input.inclusions || '',1800,true); r.exclusions = str(input.exclusions || '',1800,true);
  r.deliveryArea = str(input.deliveryArea || '',300); r.publicNotes = str(input.publicNotes || '',1800); r.internalNotes = str(input.internalNotes || '',1800);
  r.bookingMode = input.bookingMode || 'review';
  if (!['review','auto'].includes(r.bookingMode)) bad('Choose a booking acceptance option.');
  r.responseMinutes = num(input.responseMinutes ?? 60,1,10080,'confirmation time in minutes');
  if (!Number.isInteger(r.responseMinutes)) bad('Use whole minutes for confirmation timing.');
  r.ddpConfirmed = input.ddpConfirmed === true;
  if (r.published && r.product.endsWith('DDP') && (!r.deliveryArea || !r.ddpConfirmed)) bad('Confirm DDP coverage and describe delivery area, duties and tax treatment before publishing.');
  return r;
}
export function validateCargo(s, clock = today()) {
  const c = { origin: str(s.origin,120,true), destination: str(s.destination,120,true), ready: date(s.ready), mode: s.mode, cargoType: s.cargoType };
  if (routeKey(c.origin) === routeKey(c.destination) || c.ready < clock) bad('Choose different locations and a current cargo-ready date.');
  if (!['compare','sea','air','road'].includes(c.mode) || !['cartons','pallets','container','other'].includes(c.cargoType)) bad('Choose a valid mode and cargo type.');
  c.weight = num(s.weight,0.01,10000000,'gross weight'); c.cbm = c.cargoType === 'container' ? 0 : num(s.cbm,0.01,100000,'cargo volume');
  c.containerSize = s.containerSize || '20GP'; c.containers = Number(s.containers || 1);
  if (c.cargoType === 'container' && (!['20GP','40GP','40HC'].includes(c.containerSize) || !Number.isInteger(c.containers) || c.containers < 1 || c.containers > 100 || ['air','compare'].includes(c.mode))) bad('Full containers need valid equipment, quantity and sea/road mode.');
  c.ddp = s.ddp === true; c.flex = s.flex === true; return c;
}
export function compatible(rate, c) {
  if (routeKey(rate.origin) !== routeKey(c.origin) || routeKey(rate.destination) !== routeKey(c.destination)) return false;
  if (c.cargoType === 'container') return rate.product === ({'20GP':'FCL20','40GP':'FCL40','40HC':'FCL40HC'}[c.containerSize]) && c.mode === 'sea';
  if (c.mode === 'road') return rate.product === 'ROAD_LTL';
  if (rate.product.startsWith('FCL') || rate.product === 'ROAD_LTL') return false;
  return (c.mode === 'compare' || (c.mode === 'air' ? rate.product.startsWith('AIR') : rate.product.startsWith('LCL')));
}
export function estimate(rate, cargo, flags = {}, clock = today()) {
  if (!rate.published || clock > rate.validTo || cargo.ready < rate.validFrom || cargo.ready > rate.validTo || !compatible(rate,cargo)) return null;
  const reasons = [];
  if ((rate.product.startsWith('FCL') ? cargo.weight/cargo.containers : cargo.weight) > rate.maxWeight || (cargo.cbm && cargo.cbm > rate.maxCbm)) reasons.push('Cargo exceeds this tariff’s size or weight limit.');
  if (rate.maxDensity && cargo.cbm && cargo.weight / cargo.cbm > rate.maxDensity) reasons.push('Cargo exceeds this tariff’s density limit.');
  if (flags.dangerous || flags.batteries || flags.oversized || flags.stackable === false) reasons.push('Special handling requires a staff quotation.');
  let raw, unit, formula;
  if (rate.basis === 'container') { raw = cargo.containers; unit = 'container'; formula = `${cargo.containers} container(s)`; }
  if (rate.basis === 'wm') { raw = Math.max(cargo.cbm,cargo.weight/rate.kgPerCbm); unit = 'W/M'; formula = `Higher of ${cargo.cbm} CBM and ${cargo.weight} kg ÷ ${rate.kgPerCbm}`; }
  if (rate.basis === 'cbm') { raw = cargo.cbm; unit = 'CBM'; formula = `${cargo.cbm} CBM`; }
  if (rate.basis === 'actual_kg') { raw = cargo.weight; unit = 'kg'; formula = `${cargo.weight} actual kg`; }
  if (rate.basis === 'volumetric_kg') { raw = Math.max(cargo.weight,cargo.cbm*1000000/rate.volumetricDivisor); unit = 'chargeable kg'; formula = `Higher of ${cargo.weight} kg and ${cargo.cbm} CBM × 1,000,000 ÷ ${rate.volumetricDivisor}`; }
  const quantity = Math.round(Math.ceil((Math.max(raw,rate.minimumUnits)-1e-9)/rate.rounding)*rate.rounding*1000000)/1000000;
  const base = Math.round(Math.round(rate.unitPrice*100)*quantity), min = Math.round(rate.minimumCharge*100);
  const freight = Math.max(base,min);
  const charges = [{label:'Freight',amount:freight/100},...['originFee','destinationFee','documentationFee'].map((k,i)=>({label:['Origin charges (per shipment)','Destination charges (per shipment)','Documentation (per shipment)'][i],amount:rate[k]}))].filter(x=>x.amount>0);
  const totalCents = charges.reduce((n,x)=>n+Math.round(x.amount*100),0);
  if (!Number.isSafeInteger(totalCents) || totalCents > 1e12) bad('Shipment value exceeds the online estimate limit.');
  // Explicit allowlist: never serialize rate's buying cost, private notes or owner identifiers.
  return {rateId:rate.id,rateVersion:rate.version,product:rate.product,title:rate.label,currency:rate.currency,validFrom:rate.validFrom,validTo:rate.validTo,
    status:reasons.length?'REVIEW_REQUIRED':'ESTIMATE',total:reasons.length?null:totalCents/100,quantity,unit,unitPrice:rate.unitPrice,formula,minimumUnits:rate.minimumUnits,minimumCharge:rate.minimumCharge,rounding:rate.rounding,charges:reasons.length?[]:charges,
    inclusions:rate.inclusions,exclusions:rate.exclusions,deliveryArea:rate.deliveryArea,notes:rate.publicNotes,reasons,
    bookingMode:rate.bookingMode,responseMinutes:rate.responseMinutes,
    scope:rate.product.endsWith('DDP')?'DDP within the stated delivery area':rate.product === 'ROAD_LTL'?'Truck route; see inclusions and exclusions':'Port / airport freight; see inclusions and exclusions',
    notice:'Estimate based on declared cargo. Measurements and cargo acceptance must be verified. UKR booking acceptance does not confirm a carrier reservation.'};
}
export function validateContact(d) {
  const result = {};
  for (const [key,max] of Object.entries({commodity:250,packages:20,declaredValue:30,dimensions:500,pickupAddress:500,deliveryAddress:500,cargoNotes:1500,contactName:100,company:150,contactEmail:254,contactPhone:40})) result[key]=str(String(d[key] ?? ''),max,['commodity','contactName','contactEmail'].includes(key));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail)) bad('Enter a valid contact email.');
  result.contactEmail=result.contactEmail.toLowerCase();
  if (!Number.isInteger(Number(result.packages)) || Number(result.packages)<1 || Number(result.packages)>1000000) bad('Enter a whole package quantity.');
  if (result.declaredValue !== '') num(result.declaredValue,0,1e9,'declared cargo value');
  for (const k of ['stackable','batteries','dangerous','oversized']) { if (typeof d[k]!=='boolean') bad('Complete all handling questions.'); result[k]=d[k]; }
  if (d.consent !== true) bad('Agree to send the request and contact details to UKR.');
  result.consent=true; return result;
}
