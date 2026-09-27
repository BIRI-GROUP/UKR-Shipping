import {publicOptions} from './tariff-options.mjs';
import { products, routeKey, today, estimate, validateCargo } from './rates.mjs';
export const decodeRate = row => ({...JSON.parse(row.data),id:row.id,version:row.version});
export const decodeRoute = row => ({...JSON.parse(row.data),id:row.id,version:row.version,active:!!row.active});
export const routeProducts = Object.keys(products).filter(p=>p!=='FCL40HC');
const fail = message => {throw Object.assign(new Error(message),{status:400});};
export function validateRoute(data) {
  const result={active:data.active===true};
  for(const k of ['origin','destination','originCountry','destinationCountry','airOrigin','airDestination']) {
    result[k]=String(data[k]||'').trim();
    if(result[k].length>120 || (!result[k]&&!k.startsWith('air')))fail('Enter route locations and countries (up to 120 characters).');
  }
  if(routeKey(result.origin)===routeKey(result.destination))fail('Route origin and destination must differ.');
  for(const k of ['originAliases','destinationAliases']) {
    result[k]=[...new Set((Array.isArray(data[k])?data[k]:String(data[k]||'').split(/\n|\|/)).map(x=>String(x).trim()).filter(Boolean))];
    if(result[k].length>30||result[k].some(x=>x.length>120))fail('Use up to 30 city aliases per side, one per line.');
  }
  result.products=Array.isArray(data.products)?[...new Set(data.products)]:[];
  if(!result.products.length||result.products.some(p=>!routeProducts.includes(p)))fail('Choose the services operated on this route.');
  return result;
}
export const readRoutes = async db => (await db.query('SELECT * FROM freight_routes ORDER BY updated_at DESC')).rows.map(decodeRoute);
const matches=(route,side,value)=>[route[side],route[side].split(',')[0],route[side+'Country'],...route[side+'Aliases']].some(x=>routeKey(x)===routeKey(value));
export function resolveRoutes(routes,search){return routes.filter(r=>r.active&&(!search.routeId||search.routeId===r.id)&&matches(r,'origin',search.origin)&&matches(r,'destination',search.destination));}
export function rateBelongs(r,route){return r.routeId?r.routeId===route.id:routeKey(r.origin)===routeKey(route.origin)&&routeKey(r.destination)===routeKey(route.destination);}
export function enabledRate(rate,routes){const r=rate.routeId?routes.find(r=>r.id===rate.routeId):routes.find(r=>rateBelongs(rate,r));if(!r)return !rate.routeId;return !!r.active&&r.products.includes(rate.product);}
export function canonicalCargo(search,routes){const found=resolveRoutes(routes,search);if(found.length>1)fail('Several routes match. Select a specific route before estimating.');if(search.routeId&&!found.length)fail('This route is unavailable. Search again.');return found[0]?{...search,routeId:found[0].id,origin:found[0].origin,destination:found[0].destination}:search;}
export function quickOptions(route,rates,ready=today()) {
  return [...route.products].sort((a,b)=>Object.keys(products).indexOf(a)-Object.keys(products).indexOf(b)).map(product=>{
    const r=rates.filter(r=>rateBelongs(r,route)&&r.product===product&&r.published&&r.validFrom<=ready&&r.validTo>=ready&&r.validTo>=today()).sort((a,b)=>b.validFrom.localeCompare(a.validFrom))[0];
    const base={product,title:products[product],routeId:route.id,origin:route.origin,destination:route.destination,terminal:product.startsWith('AIR')?`${route.airOrigin||'Origin airport to confirm'} → ${route.airDestination||'Destination airport to confirm'}`:`${route.origin} → ${route.destination}`};
    if(!r)return {...base,available:false};
    return {...base,...publicOptions(r),available:true,rateId:r.id,currency:r.currency,unitPrice:r.tier5==null?r.unitPrice:Math.min(r.tier5,r.tier10,r.tier20,r.tierAbove20),unit:r.basis==='container'?'container':r.basis==='wm'?'chargeable CBM':r.basis==='cbm'?'CBM':'kg',minimumUnits:product.startsWith('AIR')?Math.max(5,r.minimumUnits):r.minimumUnits,minimumCharge:r.minimumCharge,validFrom:r.validFrom,validTo:r.validTo,exwFrom:r.exwFrom??null,inclusions:r.inclusions,exclusions:r.exclusions,notes:r.publicNotes,approval:product.endsWith('DDP')};
  });
}
export function magicCosts(input,route,rates) {
  const numbers={};
  for(const k of ['itemCost','quantity','length','width','height','weight']){numbers[k]=Number(input[k]);if(!Number.isFinite(numbers[k])||numbers[k]<=0||numbers[k]>1e7)fail('Enter positive item cost, quantity, packed dimensions and packed weight.');}
  if(!Number.isInteger(numbers.quantity))fail('Quantity must be a whole number.');
  const selling=input.selling===''||input.selling==null?null:Number(input.selling),extras=Number(input.extras||0);
  if((selling!==null&&(!Number.isFinite(selling)||selling<0))||!Number.isFinite(extras)||extras<0)fail('Check selling price and other costs.');
  const cbm=numbers.length*numbers.width*numbers.height*numbers.quantity/1e6,weight=numbers.weight*numbers.quantity;
  const c=validateCargo({origin:route.origin,destination:route.destination,ready:input.ready,mode:'compare',cargoType:'cartons',cbm,weight,exw:input.exw===true});
  const results=[];
  for(const r of rates.filter(r=>rateBelongs(r,route)&&route.products.includes(r.product)&&r.currency===input.currency)) {
    let cargo=c,fill=null;
    if(r.product.startsWith('FCL')){
      if(!r.containerCbm)continue;
      fill=cbm/r.containerCbm;
      if(fill<.85||fill>1||(r.maxWeight!=null&&weight>r.maxWeight))continue;
      cargo={...c,mode:'sea',cargoType:'container',cbm:0,containers:1,containerSize:({FCL20:'20GP',FCL40:'40GP',FCL40HC:'40HC',FCL45:'45HC'})[r.product]};
    }else if(!r.product.startsWith('AIR')&&!r.product.startsWith('LCL'))continue;
    const offer=estimate(r,cargo);
    if(!offer||offer.total===null)continue;
    const shipped=numbers.itemCost+(offer.total+extras)/numbers.quantity;
    results.push({title:offer.title,product:r.product,currency:r.currency,shipping:offer.total,shippedPerItem:Math.round(shipped*100)/100,profitPerItem:selling===null?null:Math.round((selling-shipped)*100)/100,margin:selling>0?Math.round((selling-shipped)/selling*10000)/100:null,fill:fill===null?null:Math.round(fill*1000)/10,charges:offer.charges,inclusions:offer.inclusions,exclusions:offer.exclusions,approvalNote:offer.approvalNote});
  }
  return {cbm,weight,quantity:numbers.quantity,currency:input.currency,options:results,notice:'Planning estimate for packed goods. Add any excluded duty, tax, insurance and local charges to other costs. Profit is before any unentered costs. Container suggestions start at 85% of owner-entered planning capacity; packing fit and payload require verification.'};
}
