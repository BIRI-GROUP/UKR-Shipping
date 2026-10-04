/* Review shipment views. Authentication fields are handled only by the existing portal. */
(function(){'use strict';const U=window.UKRPortal;if(!U)return;
const rows=[
['Private testing only. Records are separate from operational data.','للاختبار الخاص فقط. البيانات منفصلة عن بيانات التشغيل.','Только закрытое тестирование. Данные отделены от рабочих записей.','Tests privés uniquement. Les données sont séparées des données opérationnelles.','صرف نجی آزمائش کے لیے۔ معلومات اصل کاروباری ریکارڈ سے الگ ہیں۔','केवल निजी परीक्षण। रिकॉर्ड परिचालन डेटा से अलग हैं।','仅供私人测试。记录与业务数据隔离。'],
['Staff portal','بوابة الموظفين','Портал сотрудников','Portail du personnel','عملے کا پورٹل','स्टाफ पोर्टल','员工门户'],
['Customer portal','بوابة العملاء','Кабинет клиента','Espace client','کسٹمر پورٹل','ग्राहक पोर्टल','客户门户'],
['Enter test code 1234. No email was sent.','أدخل رمز الاختبار 1234. لم يُرسل أي بريد إلكتروني.','Введите тестовый код 1234. Письмо не отправлялось.','Saisissez le code de test 1234. Aucun e-mail n’a été envoyé.','آزمائشی کوڈ 1234 درج کریں۔ کوئی ای میل نہیں بھیجی گئی۔','परीक्षण कोड 1234 दर्ज करें। कोई ईमेल नहीं भेजा गया।','请输入测试代码 1234。未发送任何电子邮件。'],
['Use customer@ukr.test or second.customer@ukr.test for customer testing.','استخدم customer@ukr.test أو second.customer@ukr.test لاختبار بوابة العملاء.','Для проверки клиентов используйте customer@ukr.test или second.customer@ukr.test.','Utilisez customer@ukr.test ou second.customer@ukr.test pour tester l’espace client.','کسٹمر ٹیسٹ کے لیے customer@ukr.test یا second.customer@ukr.test استعمال کریں۔','ग्राहक परीक्षण के लिए customer@ukr.test या second.customer@ukr.test उपयोग करें।','请使用 customer@ukr.test 或 second.customer@ukr.test 测试客户门户。']
];
const order=['en','ar','ru','fr','ur','hi','zh'];for(const row of rows)order.forEach((l,i)=>window.UKRPortalMessages[l][row[0]]=row[i]);
order.forEach((l,i)=>{window.UKRPortalMessages[l].verification_requested=rows[3][i];window.UKRPortalMessages[l].review_customer_required=rows[4][i];});
const bar=U.raw('section',null,'panel');bar.id='privateReviewNotice';bar.style.margin='12px';bar.setAttribute('role','note');bar.append(U.copy('p',rows[0][0]),U.copy('p',rows[3][0]),U.copy('p',rows[4][0]));
for(const [label,path]of [['Staff portal','/staff/'],['Customer portal','/customer/']]){const link=U.copy('a',label);link.href=path;link.style.marginInlineEnd='20px';bar.append(link);}document.body.prepend(bar);
const bookingRows=`
New booking|حجز جديد|Новое бронирование|Nouvelle réservation|نئی بکنگ|नई बुकिंग|新建预订
Service|الخدمة|Услуга|Service|سروس|सेवा|服务
Origin country code|رمز بلد المنشأ|Код страны отправления|Code du pays de départ|روانگی کے ملک کا کوڈ|प्रस्थान देश कोड|始发国家代码
Destination country code|رمز بلد الوجهة|Код страны назначения|Code du pays de destination|منزل کے ملک کا کوڈ|गंतव्य देश कोड|目的国家代码
Cargo summary|وصف البضاعة|Описание груза|Description du fret|سامان کی تفصیل|कार्गो का विवरण|货物说明
ETA|الوصول المتوقع|Ожидаемое прибытие|Arrivée estimée|متوقع آمد|अनुमानित आगमन|预计到达
Last updated|آخر تحديث|Последнее обновление|Dernière mise à jour|آخری اپ ڈیٹ|अंतिम अपडेट|最后更新
View|عرض|Открыть|Voir|دیکھیں|देखें|查看
Submit|إرسال|Отправить|Envoyer|جمع کریں|जमा करें|提交
Reason|السبب|Причина|Motif|وجہ|कारण|原因
submitted|تم تقديم الحجز|Заявка отправлена|Réservation soumise|بکنگ جمع ہو گئی|बुकिंग जमा हुई|已提交预订
Storage|التخزين|Хранение|Stockage|اسٹوریج|भंडारण|仓储
Update ETA|تحديث الوصول المتوقع|Изменить срок прибытия|Modifier l’arrivée estimée|متوقع آمد تبدیل کریں|आगमन का समय अपडेट करें|更新预计到达
Create your company profile before booking.|أنشئ ملف شركتك قبل الحجز.|Создайте профиль компании перед бронированием.|Créez le profil de votre entreprise avant de réserver.|بکنگ سے پہلے کمپنی پروفائل بنائیں۔|बुकिंग से पहले कंपनी प्रोफ़ाइल बनाएँ।|请先创建公司资料，再进行预订。
`;for(const row of bookingRows.trim().split('\n').map(s=>s.split('|')))order.forEach((l,i)=>window.UKRPortalMessages[l][row[0]]=row[i]);
const services=[['air_ddp','Air DDP'],['sea_ddp','Sea DDP'],['air_express','Air Express'],['sea_lcl','Sea LCL'],['sea_fcl','Sea FCL'],['land','Land Transport'],['storage','Storage'],['customs','Customs Clearance']];
const serviceName=code=>services.find(x=>x[0]===code)?.[1]||code;
function companyPrompt(box){box.append(U.copy('p','Create your company profile before booking.'),U.button('Company account',()=>U.render('company')));}
async function details(id){const out=await U.request('/bookings/'+id),b=out.booking;U.dialog('My Shipments',box=>{box.append(U.raw('h3',b.code),U.raw('p',b.origin+' → '+b.destination),U.raw('p',U.t('ETA')+': '+U.formatDate(b.eta)),U.raw('p',b.cargo_summary));U.table(box,out.events,[[e=>U.formatDate(e.occurred_at),'Last updated'],[e=>U.t(e.status||e.to_status),'Status'],[e=>e.eta?U.formatDate(e.eta):'','ETA']]);if(U.state.kind==='staff'&&U.has(b.service,'edit')){const f=U.raw('form');U.field(f,'eta','ETA',{type:'datetime-local',required:true});U.field(f,'reason','Reason',{required:true,maxLength:1000});U.submit(f,'Update ETA',()=>U.request('/bookings/'+id+'/eta',{version:b.version,eta:new Date(f.elements.eta.value).toISOString(),reason:f.elements.reason.value},'PUT'));box.append(f);}});}
async function bookings(service=null,title='My Shipments'){const box=U.clear(title);if(U.state.kind==='customer'){const profile=await U.request('/customer/profile');if(!profile.company?.id){companyPrompt(box);return;}}const out=await U.request('/bookings'+(service?'?service='+service:''));if(U.state.kind==='customer')box.append(U.button('New booking',()=>U.render('booking')));U.table(box,out.items,[['code','Reference'],[b=>U.t(serviceName(b.service)),'Service'],['origin','Origin'],['destination','Destination'],[b=>U.t(b.status),'Status'],[b=>U.formatDate(b.eta),'ETA']],(td,b)=>td.append(U.button('View',()=>details(b.id))));}
U.register('customer:dashboard',()=>bookings(null,'Dashboard'));U.register('customer:shipments',()=>bookings());for(const [code,label]of services)U.register('staff:'+code,()=>bookings(code,label));
U.register('customer:booking',async()=>{const box=U.clear('New booking'),p=await U.request('/customer/profile');if(!p.company?.id){companyPrompt(box);return;}const f=U.raw('form',null,'panel form-grid');U.field(f,'service','Service',{options:services.map(([value,label])=>({value,label}))});for(const [name,label,value]of [['legal_owner_name','Legal company name',p.company.legal_name],['phone','Phone',p.phone],['origin','Origin','China'],['destination','Destination','UAE'],['origin_country','Origin country code','CN'],['destination_country','Destination country code','AE'],['cargo_summary','Cargo summary','']])U.field(f,name,label,{value,required:true,maxLength:name.endsWith('country')?2:name==='phone'?40:name==='cargo_summary'?2000:200});const key=crypto.randomUUID();U.submit(f,'Submit',()=>U.request('/bookings',{...U.data(f),request_key:key}),async result=>{await U.render('shipments');await details(result.booking.id);});box.append(f);});
})();
