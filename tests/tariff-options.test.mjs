import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRate,validateCargo,estimate,today} from '../services/staff/rates.mjs';
import {makeWorkbook,parseWorkbook} from '../services/staff/rate-workbook.mjs';
const day=today();
const input={origin:'Test hub',destination:'Test port',product:'LCL_DDP',validFrom:day,validTo:day,currency:'AED',priceMode:'selling',sellingRate:100,basis:'wm',minimumUnits:1,rounding:.01,kgPerCbm:475,maxWeight:null,maxCbm:null,inclusions:'Warehouse freight',exclusions:'Taxes require approval',deliveryArea:'City limits',warehouseOrigin:true,bookingMode:'auto',published:true,tier5:100,tier10:90,tier20:80,tierAbove20:70};
const cargo=(cbm,extra={})=>validateCargo({origin:'Test hub',destination:'Test port',ready:day,mode:'sea',cargoType:'cartons',weight:100,cbm,...extra});
test('selling-only tariffs have no invented purchase price; tier boundaries retain fractions',()=>{
 const r=validateRate(input);assert.equal(r.buyRate,null);assert.equal(r.unitPrice,100);
 for(const [cbm,price,quantity]of [[.5,100,1],[1.5,100,1.5],[5,100,5],[5.25,90,5.25],[10,90,10],[10.5,80,10.5],[20,80,20],[20.5,70,20.5],[21,70,21]]){const o=estimate(r,cargo(cbm));assert.equal(o.unitPrice,price);assert.equal(o.quantity,quantity);assert.equal(o.total,Math.round(quantity*price*100)/100);assert.equal(o.bookingMode,'review');assert.equal(o.requiresApproval,true);}
 assert.throws(()=>validateRate({...input,tier20:''}));assert.throws(()=>validateRate({...input,sellingRate:1.001}));
});
test('air minimum, volumetric weight, handling and single-box delivery eligibility',()=>{
 const delivery=[{zone:'sharjah',airOneBox:10,upTo5:40,upTo10:60,upTo20:80,above20:100}];
 const r=validateRate({...input,product:'AIR_EXPRESS',basis:'volumetric_kg',minimumUnits:5,rounding:1,tier5:null,tier10:null,tier20:null,tierAbove20:null,sellingRate:2,sensitivePerKg:3,carePerKg:4,deliveryRates:delivery,warehouseOrigin:false,bookingMode:'review'});
 assert.equal(estimate(r,cargo(.01,{mode:'air',weight:1})).total,10);
 assert.equal(estimate(r,cargo(.12,{mode:'air',weight:1})).quantity,20);
 const c=cargo(.01,{mode:'air',weight:10,ddp:true,deliveryZone:'sharjah',deliveryPackages:1});
 assert.equal(estimate(r,c).total,30);assert.equal(estimate(r,c,{packages:'2'}).total,60);
 assert.equal(estimate(r,{...c,weight:25}).total,90);assert.equal(estimate(r,{...c,mode:'sea'}),null);
 assert.equal(estimate(r,c,{batteries:true}).total,60);assert.equal(estimate(r,c,{extraCare:true}).total,70);
 assert.equal(estimate(r,c,{extraCare:true}).requiresApproval,true);assert.equal(estimate(r,c,{batteries:true,extraCare:true}).total,null);
 assert.equal(estimate(r,{...c,deliveryZone:'other'}).total,null);
 assert.equal(estimate(r,{...c,deliveryZone:'collection'}).total,20);
 assert.equal(estimate(r,c,{dangerous:true}).total,null);
});
test('delivery CBM boundaries apply to non-parcel cargo and unsupported currencies reject delivery prices',()=>{
 const r=validateRate({...input,deliveryRates:[{zone:'ajman',airOneBox:10,upTo5:40,upTo10:60,upTo20:80,above20:100}]});
 for(const [cbm,fee]of [[5,40],[5.25,60],[10,60],[10.5,80],[20,80],[20.5,100]])assert.equal(estimate(r,cargo(cbm,{ddp:true,deliveryZone:'ajman',deliveryPackages:1})).charges.find(x=>x.code==='delivery').amount,fee);
 assert.throws(()=>validateRate({...input,currency:'USD',deliveryRates:r.deliveryRates}));
});
test('selling-only rates, tiers, metadata and delivery survive Excel download/upload',async()=>{
 const r=validateRate({...input,routeId:'test-route',transitMin:3,transitMax:5,deliveryRates:[{zone:'dubai',airOneBox:0,upTo5:0,upTo10:0,upTo20:0,above20:0}]});
 const end=new Date(Date.parse(day)+6*86400000).toISOString().slice(0,10);r.validTo=end;
 const bytes=await makeWorkbook([{id:'test-route',origin:r.origin,destination:r.destination,active:true,products:['LCL_DDP']}],[r],day);
 const [parsed]=await parseWorkbook(bytes);const again=validateRate(parsed.value);assert.equal(again.buyRate,null);assert.equal(again.sellingRate,100);assert.equal(again.tierAbove20,70);assert.equal(again.deliveryRates[0].upTo5,0);assert.equal(again.transitMin,3);
});
