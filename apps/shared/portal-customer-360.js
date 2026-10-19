/* UKR 360: authenticated customer view using live company-scoped records only.
   No sample shipments, rate promises, payment links or mock document downloads. */
(function(){'use strict';
const U=window.UKRPortal;if(!U)return;
const {state,raw,clear,request,table}=U;
const L=(en,ar)=>state.locale==='ar'?ar:en;
const el=(tag,en,ar,cls='')=>raw(tag,L(en,ar),cls);
const serviceNames={sea_lcl:['Sea LCL','شحن بحري جزئي'],sea_fcl:['Sea FCL','حاوية كاملة'],air_express:['Air Express','الشحن الجوي السريع'],air_ddp:['Air DDP','الشحن الجوي شامل الرسوم'],sea_ddp:['Sea DDP','الشحن البحري شامل الرسوم'],land:['Land Transport','النقل البري'],customs:['Customs Clearance','التخليص الجمركي'],storage:['Storage','التخزين']};
const labelService=code=>L(...(serviceNames[code]||[code,code]));
const statuses={submitted:['Awaiting UKR review','بانتظار مراجعة UKR'],accepted:['Booked','تم الحجز'],goods_received:['Received','تم الاستلام'],in_transit:['In transit','قيد الشحن'],arrived:['Arrived','وصلت'],customs_cleared:['Customs cleared','تم التخليص الجمركي'],ready_for_delivery:['Ready for delivery','جاهز للتسليم'],out_for_delivery:['Out for delivery','خرج للتسليم'],delivered:['Delivered','تم التسليم'],on_hold:['On hold','معلق'],cancelled:['Cancelled','ملغى'],declined:['Declined','مرفوض']};
const status=code=>L(...(statuses[code]||[code,code]));
function action(en,ar,handler,secondary=false){
 const b=raw('button',L(en,ar),secondary?'secondary':'');b.type='button';
 b.addEventListener('click',async()=>{b.disabled=true;try{await handler();}catch(e){U.error(e);}finally{if(b.isConnected)b.disabled=false;}});
 return b;
}
function panel(box,en,ar){const p=raw('section',null,'ukr360-panel');p.append(el('h2',en,ar));box.append(p);return p;}
function note(box,en,ar,cls='muted'){box.append(el('p',en,ar,cls));}
function linkPage(box,en,ar,target){box.append(action(en,ar,()=>U.render(target),true));}
function shipmentRow(b){
 const article=raw('article',null,'ukr360-shipment');
 const main=raw('div');main.append(raw('strong',b.code),raw('div',labelService(b.service),'muted'),raw('div',b.origin+' → '+b.destination,'ukr360-route'));
 const meta=raw('div');meta.append(raw('strong',status(b.status)),raw('div',L('Expected ETA: ','الوصول المتوقع: ')+ (b.eta?U.formatDate(b.eta):L('Awaiting confirmation','بانتظار التأكيد')),'muted'));
 article.append(main,meta,action('Timeline','الخط الزمني',()=>tracking(b.id),true));return article;
}
async function tracking(id){
 const result=await request('/bookings/'+encodeURIComponent(id)),b=result.booking;
 U.dialog(L('Shipment timeline','الخط الزمني للشحنة'),box=>{
   box.append(raw('h3',b.code),raw('p',b.origin+' → '+b.destination),raw('p',status(b.status)));
   note(box,'Expected arrival: '+(b.eta?U.formatDate(b.eta):'not confirmed'),'الوصول المتوقع: '+(b.eta?U.formatDate(b.eta):'لم يؤكد بعد'));
   const events=raw('div',null,'ukr360-timeline');
   for(const e of result.events||[]){
     const item=raw('article');
     item.append(raw('strong',status(e.status)),raw('div',U.formatDate(e.occurred_at),'muted'));
     if(e.note)item.append(raw('p',e.note));
     events.append(item);
   }
   if(!events.children.length)note(events,'No customer-visible updates yet.','لا توجد تحديثات متاحة للعميل بعد');
   box.append(events);
   if(['sea_lcl','sea_fcl','sea_ddp'].includes(b.service))
     note(box,'Sea shipments require a packing list. Contact UKR to supply missing documents until secure uploads are enabled.','تتطلب الشحنات البحرية قائمة تعبئة. يرجى التواصل مع UKR لتقديم المستندات حتى تتوفر خاصية الرفع الآمن.');
   note(box,'Documents are available only after UKR has verified and released them.','لا تتوفر المستندات إلا بعد مراجعتها وإصدارها من UKR.');
 });
}
async function listShipments(title='My Shipments'){
 const box=clear(title),tools=raw('div',null,'ukr360-actions');tools.append(action('Request a quote','اطلب عرض سعر',()=>U.render('booking')));box.append(tools);
 const out=await request('/bookings?limit=50&offset=0');
 if(!out.items.length)note(box,'No linked shipments yet. UKR will connect existing shipment records to this company account.','لا توجد شحنات مرتبطة بهذا الحساب بعد. سيقوم فريق UKR بربط سجلات الشحن بالشركة.');
 for(const b of out.items)box.append(shipmentRow(b));
 if(out.total>out.items.length)note(box,'Showing the first 50 shipments. More history is available after pagination is enabled.','يتم عرض أول 50 شحنة، وستتوفر بقية السجلات بعد تفعيل التنقل بين الصفحات.');
}
U.register('customer:dashboard',async()=>{
 const box=clear('Dashboard'),s=await request('/bookings/summary');
 const top=raw('div',null,'ukr360-hero');
 top.append(el('h2','Welcome to UKR 360','مرحباً بك في UKR 360'));
 note(top,'Your shipment status, documents and requests in one place.','حالة الشحنات والمستندات والطلبات في مكان واحد.');
 const actions=raw('div',null,'ukr360-actions');
 actions.append(action('Get Quote & Book','عرض سعر وحجز',()=>U.render('booking')),action('My shipments','شحناتي',()=>U.render('shipments'),true),action('My Finance','حساباتي',()=>U.render('invoices'),true));
 top.append(actions);box.append(top);
 const stats=raw('div',null,'ukr360-stats');
 for(const [value,en,ar] of [[s.in_transit,'In transit','قيد الشحن'],[s.booked,'Booked','تم الحجز'],[s.waiting_to_load,'Received · Waiting to load','تم الاستلام · بانتظار التحميل'],[s.total_shipped,'Total shipped (history)','إجمالي الشحنات المرسلة']]){
   const c=raw('article',null,'ukr360-stat');c.append(raw('strong',String(value)),el('span',en,ar));stats.append(c);
 }box.append(stats);
 if(s.awaiting_confirmation)note(box,'Quotation or booking requests awaiting review: '+s.awaiting_confirmation,'طلبات تنتظر المراجعة: '+s.awaiting_confirmation);
 const recent=panel(box,'Recent shipments','أحدث الشحنات'),out=await request('/bookings?limit=10&offset=0');
 if(!out.items.length)note(recent,'Your shipments will appear here after UKR links them to your approved account.','ستظهر شحناتك هنا بعد ربطها بحساب شركتك المعتمد.');
 for(const b of out.items)recent.append(shipmentRow(b));
 linkPage(recent,'View shipment history','عرض سجل الشحنات','shipments');
});
U.register('customer:shipments',()=>listShipments());
U.register('customer:booking',async()=>{
 const box=clear('Booking'),p=panel(box,'Get Quote & Book','طلب عرض سعر وحجز');
 note(p,'No instant selling prices are available. This sends a request for UKR staff review, not a confirmed booking or guaranteed rate.','لا توجد أسعار فورية حالياً. سيتم إرسال طلب للمراجعة وليس حجزاً مؤكداً أو سعراً مضموناً.');
 const form=raw('form',null,'ukr360-form');
 const f=(name,en,ar,options)=>U.field(form,name,L(en,ar),options||{required:true,maxLength:200});
 f('service','Service','الخدمة',{required:true,options:Object.entries(serviceNames).map(([value,names])=>({value,label:L(...names)})),rawOptions:true});
 f('origin','From (city, port or airport)','من (المدينة أو الميناء أو المطار)');
 f('origin_country','Origin country code','رمز دولة المنشأ',{required:true,maxLength:2});
 f('destination','To (city, port or airport)','إلى (المدينة أو الميناء أو المطار)');
 f('destination_country','Destination country code','رمز بلد الوجهة',{required:true,maxLength:2});
 f('legal_owner_name','Cargo owner / company','صاحب الشحنة / الشركة');
 f('phone','Contact phone','رقم التواصل');
 f('cargo_summary','Cargo details, quantity, weight and dimensions','وصف الشحنة والكمية والوزن والأبعاد',{required:true,type:'textarea',maxLength:2000});
 const submit=raw('button',L('Send request','إرسال الطلب'));submit.type='submit';form.append(submit);
 form.addEventListener('submit',async e=>{
  e.preventDefault();submit.disabled=true;
  try{
   const data=U.data(form);
   data.origin_country=data.origin_country.trim().toUpperCase();
   data.destination_country=data.destination_country.trim().toUpperCase();
   data.request_key=crypto.randomUUID().replaceAll('-','');
   const result=await request('/bookings',data);
   const receipt=el('p','Request submitted for UKR review: ','تم إرسال الطلب للمراجعة: ','success');
   receipt.append(raw('strong',result.booking.code));p.append(receipt);
   form.reset();
  }catch(e){U.error(e);}finally{submit.disabled=false;}
 });
 p.append(form);
 note(p,'Air Cargo, FCL, LCL and other services are request-only until UKR activates approved workflows.','الشحن الجوي والحاويات الجزئية والكاملة والخدمات الأخرى متاحة حالياً كطلبات للمراجعة فقط.');
});
U.register('customer:requests',()=>U.render('booking'));
U.register('customer:pricing',()=>{
 const box=clear('Pricing'),p=panel(box,'Request a quotation','طلب عرض سعر');
 note(p,'Live rates are not enabled. Your company will receive UKR-approved quotations after review.','لم يتم تفعيل الأسعار الفورية. سيتم إرسال عروض أسعار معتمدة من UKR بعد المراجعة.');
 linkPage(p,'Get Quote & Book','عرض سعر وحجز','booking');
});
U.register('customer:documents',()=>{
 const box=clear('Documents'),p=panel(box,'Documents & House B/L','المستندات وسند الشحن الداخلي');
 note(p,'House Bills of Lading for LCL will be downloadable only after UKR issues them. FCL carrier B/L documents will appear after verification and release.','ستتوفر سندات الشحن الداخلي للشحنات الجزئية بعد إصدارها من UKR، كما ستتوفر مستندات الخط الملاحي بعد مراجعتها وإتاحتها.');
 note(p,'Packing lists are required for sea freight. Secure document uploads will be enabled after staff approval and storage testing.','قائمة التعبئة مطلوبة للشحن البحري. سيتم تفعيل رفع المستندات الآمن بعد اعتماد الفريق واختبار التخزين.');
});
U.register('customer:invoices',()=>{
 const box=clear('Invoices & Payments'),p=panel(box,'My Finance','حساباتي المالية');
 note(p,'Your invoices and payment status will be shown once the UKR POS financial records are securely connected. No balance is displayed until reconciled.','ستظهر الفواتير وحالة السداد بعد الربط الآمن مع سجلات نظام UKR. لن يظهر أي رصيد قبل المطابقة.');
});
for(const [key,en,ar] of [['fulfilment','Fulfilment','تنفيذ الطلبات'],['feedback','Feedback','التقييم'],['china_payment','Pay for cargo in China','الدفع للبضائع في الصين']]){
 U.register('customer:'+key,()=>{const box=clear(en);note(box,'This service is under development. Contact UKR for assistance.','هذه الخدمة قيد التطوير، يرجى التواصل مع UKR للمساعدة.');});
}
window.addEventListener('ukr:portal-language',()=>{
 if(state.kind==='customer'&&state.me)U.render(state.page).catch(U.error);
});
})();
