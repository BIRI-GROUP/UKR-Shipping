// Optional selling-price tiers and delivery tariffs. Monetary amounts use the rate currency.
export const deliveryZones=['dubai','sharjah','ajman','uaq','rak','abudhabi','alain'];
export const optionColumns=[['priceMode','Price entry mode',20],['sellingRate','Selling price per unit',22],['tier5','Selling up to 5 CBM',23],['tier10','Selling above 5 to 10 CBM',28],['tier20','Selling above 10 to 20 CBM',28],['tierAbove20','Selling above 20 CBM',26],['sensitivePerKg','Sensitive or battery per kg',28],['carePerKg','Extra care or cosmetics per kg',30],['transitMin','Transit minimum days',23],['transitMax','Transit maximum days',23],['availableContainers','Containers in hand',22],['warehouseOrigin','Customer delivers to warehouse',32]];
export const deliveryColumns=[['routeId','Route ID',38],['product','Service code',18],['zone','Delivery city code',20],['airOneBox','Air one box under 25 kg',26],['upTo5','Cargo up to 5 CBM',23],['upTo10','Cargo above 5 to 10 CBM',28],['upTo20','Cargo above 10 to 20 CBM',28],['above20','Cargo above 20 CBM',25]];
const fail=m=>{throw Object.assign(new Error(m),{status:400});};
const amount=(v,key)=>{if(v===''||v==null)return null;const n=Number(v);if(typeof v==='boolean'||!Number.isFinite(n)||n<0||n>1000000||Math.abs(n*100-Math.round(n*100))>.00001)fail('Enter a valid '+key+'.');return n;};
export function normalizeOptions(input,r){
 for(const key of ['tier5','tier10','tier20','tierAbove20','sensitivePerKg','carePerKg'])r[key]=amount(input[key],key);
 const tiers=['tier5','tier10','tier20','tierAbove20'];
 if(tiers.some(k=>r[k]!=null)&&(!r.product.startsWith('LCL')||tiers.some(k=>!r[k])||r.priceMode!=='selling'))fail('LCL tiers require all four positive selling prices and selling price mode.');
 for(const key of ['transitMin','transitMax','availableContainers']){r[key]=amount(input[key],key);if(r[key]!=null&&!Number.isInteger(r[key]))fail('Use whole numbers for transit days and container availability.');}
 if((r.transitMin==null)!==(r.transitMax==null)||r.transitMin>r.transitMax)fail('Enter both transit limits in ascending order.');
 if((r.sensitivePerKg!=null||r.carePerKg!=null)&&!r.product.startsWith('AIR'))fail('Per-kg handling charges apply to air tariffs.');
 r.warehouseOrigin=input.warehouseOrigin===true||String(input.warehouseOrigin).toUpperCase()==='YES';
 r.deliveryRates=[];
 if(input.deliveryRates?.length){
  if(!Array.isArray(input.deliveryRates)||input.deliveryRates.length>7||r.currency!=='AED')fail('Local delivery tariffs must use AED and up to seven cities.');
  const seen=new Set();for(const row of input.deliveryRates){if(!deliveryZones.includes(row.zone)||seen.has(row.zone))fail('Choose a unique supported delivery city.');seen.add(row.zone);const d={zone:row.zone};for(const key of ['airOneBox','upTo5','upTo10','upTo20','above20']){d[key]=amount(row[key],'delivery '+key);if(d[key]==null)fail('Complete every delivery amount for each configured city.');}r.deliveryRates.push(d);}
 }
}
export function tierPrice(r,quantity){if(r.tier5==null)return r.unitPrice;return quantity<=5?r.tier5:quantity<=10?r.tier10:quantity<=20?r.tier20:r.tierAbove20;}
export function deliveryCharge(r,c,details){
 if(!c.ddp)return null;
 if(c.deliveryZone==='collection')return {label:'Ras Al Khor collection',code:'collection',amount:0};
 const row=r.deliveryRates?.find(d=>d.zone===c.deliveryZone);
 if(!row)return {error:'Delivery location or charges require confirmation.'};
 const packages=Number(details.packages??c.deliveryPackages??0);
 const airBox=r.product.startsWith('AIR')&&packages===1&&c.weight<25;
 const amount=airBox?row.airOneBox:c.cbm<=5?row.upTo5:c.cbm<=10?row.upTo10:c.cbm<=20?row.upTo20:row.above20;
 return {label:'Local cargo delivery',code:'delivery',amount,zone:c.deliveryZone,airOneBox:airBox};
}
export function publicOptions(r){return {priceTiers:r.tier5==null?[]:[{upTo:5,price:r.tier5},{upTo:10,price:r.tier10},{upTo:20,price:r.tier20},{upTo:null,price:r.tierAbove20}],transitMin:r.transitMin??null,transitMax:r.transitMax??null,availableContainers:r.availableContainers??null,warehouseOrigin:!!r.warehouseOrigin,sensitivePerKg:r.sensitivePerKg??null,carePerKg:r.carePerKg??null};}
