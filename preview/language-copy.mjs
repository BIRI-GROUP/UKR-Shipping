// New draft copy, independent of layout. Order: English, Arabic, Russian, French, Urdu, Hindi, Simplified Chinese.
// These are working translations, not approval of commercial terms or a full-site translation sign-off.
export const columns = ['en','ar','ru','fr','ur','hi','zh'];
export const rows = `
nav.book|Book shipment|احجز شحنة|Забронировать перевозку|Réserver un envoi|شپمنٹ بک کریں|शिपमेंट बुक करें|预订运输
nav.info|Information & tools|المعلومات والأدوات|Информация и инструменты|Informations et outils|معلومات اور ٹولز|जानकारी और उपकरण|信息与工具
nav.news|News|الأخبار|Новости|Actualités|خبریں|समाचार|新闻
nav.contact|Contact us|اتصل بنا|Связаться с нами|Nous contacter|ہم سے رابطہ کریں|संपर्क करें|联系我们
nav.track|Track shipment|تتبع الشحنة|Отследить груз|Suivre un envoi|شپمنٹ ٹریک کریں|शिपमेंट ट्रैक करें|货物追踪
nav.customer|Customer login|دخول العملاء|Вход для клиентов|Connexion client|صارف لاگ ان|ग्राहक लॉगिन|客户登录
nav.staff|Staff login|دخول الموظفين|Вход для сотрудников|Connexion du personnel|عملے کا لاگ ان|कर्मचारी लॉगिन|员工登录
nav.services|Our services|خدماتنا|Наши услуги|Nos services|ہماری خدمات|हमारी सेवाएँ|我们的服务
nav.careers|Join our team|انضم إلى فريقنا|Присоединяйтесь к команде|Rejoignez notre équipe|ہماری ٹیم میں شامل ہوں|हमारी टीम से जुड़ें|加入我们
nav.tools|Shipping tools|أدوات الشحن|Инструменты для перевозок|Outils d’expédition|شپنگ ٹولز|शिपिंग उपकरण|运输工具
nav.routes|Routes & destinations|المسارات والوجهات|Маршруты и направления|Liaisons et destinations|راستے اور منزلیں|मार्ग और गंतव्य|线路与目的地
nav.knowledge|Knowledge Centre|مركز المعرفة|База знаний|Centre de connaissances|معلوماتی مرکز|ज्ञान केंद्र|知识中心
home.choose|Choose your service|اختر خدمتك|Выберите услугу|Choisissez votre service|اپنی سروس منتخب کریں|अपनी सेवा चुनें|选择服务
home.what|What would you like to ship?|ماذا تريد أن تشحن؟|Что вы хотите отправить?|Que souhaitez-vous expédier ?|آپ کیا بھیجنا چاہتے ہیں؟|आप क्या भेजना चाहते हैं?|您要运送什么？
home.select|Select a service to start your search.|اختر خدمة لبدء البحث.|Выберите услугу, чтобы начать поиск.|Sélectionnez un service pour lancer la recherche.|تلاش شروع کرنے کے لیے سروس منتخب کریں۔|खोज शुरू करने के लिए सेवा चुनें।|选择服务以开始搜索。
home.seven|Seven services. One simple place to start.|سبع خدمات. بداية واحدة سهلة.|Семь услуг. Начать просто.|Sept services. Un point de départ simple.|سات خدمات۔ آغاز کے لیے ایک آسان جگہ۔|सात सेवाएँ। शुरुआत के लिए एक आसान जगह।|七种服务，轻松启程。
service.fcl|Sea FCL|شحن بحري بحاوية كاملة|Морские перевозки FCL|Maritime FCL|مکمل کنٹینر بحری کارگو|समुद्री FCL|整箱海运
service.lcl|Sea LCL|شحن بحري جزئي|Морские перевозки LCL|Maritime LCL|مشترکہ کنٹینر بحری کارگو|समुद्री LCL|拼箱海运
service.seaddp|Sea DDP|شحن بحري DDP|Морские перевозки DDP|Maritime DDP|بحری DDP|समुद्री DDP|海运DDP
service.airddp|Air DDP|شحن جوي DDP|Авиаперевозки DDP|Aérien DDP|فضائی DDP|हवाई DDP|空运DDP
service.express|Air Express|شحن جوي سريع|Экспресс-авиаперевозки|Express aérien|ایکسپریس فضائی کارگو|हवाई एक्सप्रेस|航空快递
service.land|Land Transport|النقل البري|Наземные перевозки|Transport routier|زمینی نقل و حمل|सड़क परिवहन|陆路运输
service.customs|Customs Clearance|التخليص الجمركي|Таможенное оформление|Dédouanement|کسٹمز کلیئرنس|सीमा शुल्क निकासी|清关服务
service.full|Full containers|حاويات كاملة|Полные контейнеры|Conteneurs complets|مکمل کنٹینرز|पूरे कंटेनर|整箱运输
service.shared|Shared containers|حاويات مشتركة|Сборные контейнеры|Conteneurs partagés|مشترکہ کنٹینرز|साझा कंटेनर|拼箱运输
service.china|China to GCC|من الصين إلى دول الخليج|Из Китая в страны ССАГПЗ|Chine vers pays du CCG|چین سے خلیجی ممالک|चीन से GCC|中国至海合会国家
service.fast|Express cargo|شحن سريع|Экспресс-доставка|Fret express|ایکسپریس کارگو|एक्सप्रेस कार्गो|快件运输
service.truck|Cross-border trucking|نقل بري عبر الحدود|Трансграничные автоперевозки|Transport routier transfrontalier|سرحد پار ٹرک ٹرانسپورٹ|सीमा पार ट्रक परिवहन|跨境卡车运输
service.clear|Clearance support|دعم التخليص|Помощь с оформлением|Assistance au dédouanement|کلیئرنس میں معاونت|निकासी सहायता|清关支持
field.from|From|من|Откуда|Départ|روانگی|से|始发地
field.to|Deliver to|التوصيل إلى|Доставить в|Livrer à|ڈیلیوری کی منزل|यहाँ पहुँचाएँ|送达地
field.origin|From · origin port|من · ميناء المنشأ|Откуда · порт отправления|Départ · port d’origine|روانگی کی بندرگاہ|से · मूल बंदरगाह|始发港
field.destination|To · destination port|إلى · ميناء الوجهة|Куда · порт назначения|Arrivée · port de destination|منزل کی بندرگاہ|तक · गंतव्य बंदरगाह|目的港
field.ready|Cargo ready date|تاريخ جاهزية البضاعة|Дата готовности груза|Date de disponibilité|کارگو تیار ہونے کی تاریخ|माल तैयार होने की तारीख|备货日期
field.container|Container size|حجم الحاوية|Размер контейнера|Taille du conteneur|کنٹینر کا سائز|कंटेनर का आकार|箱型
field.containers|Containers|الحاويات|Контейнеры|Conteneurs|کنٹینرز|कंटेनर|集装箱数量
field.volume|Volume · CBM|الحجم · متر مكعب|Объём · м³|Volume · m³|حجم · مکعب میٹر|आयतन · घन मीटर|体积 · 立方米
field.weight|Gross weight · kg|الوزن الإجمالي · كجم|Вес брутто · кг|Poids brut · kg|مجموعی وزن · کلوگرام|कुल वजन · किलोग्राम|毛重 · 千克
field.customer|Customer name|اسم العميل|Имя клиента|Nom du client|صارف کا نام|ग्राहक का नाम|客户姓名
field.company|Company name|اسم الشركة|Название компании|Nom de l’entreprise|کمپنی کا نام|कंपनी का नाम|公司名称
field.phone|Phone|الهاتف|Телефон|Téléphone|فون|फ़ोन|电话
field.email|Email|البريد الإلكتروني|Электронная почта|E-mail|ای میل|ईमेल|电子邮箱
field.confirmemail|Confirm email|تأكيد البريد الإلكتروني|Повторите электронную почту|Confirmer l’e-mail|ای میل کی تصدیق|ईमेल की पुष्टि करें|确认邮箱
field.goods|Goods description|وصف البضاعة|Описание товара|Description des marchandises|سامان کی تفصیل|माल का विवरण|货物描述
field.quantity|Quantity to book|الكمية المطلوبة للحجز|Количество для бронирования|Quantité à réserver|بکنگ کی مقدار|बुकिंग की मात्रा|预订数量
field.address|Billing address|عنوان الفاتورة|Платёжный адрес|Adresse de facturation|بلنگ کا پتہ|बिलिंग पता|账单地址
field.tax|VAT / tax registration number|رقم التسجيل الضريبي|Налоговый номер|Numéro de TVA / fiscal|وی اے ٹی / ٹیکس رجسٹریشن نمبر|वैट / कर पंजीकरण संख्या|增值税／税务登记号
field.addtax|Add my VAT / tax registration number & billing address|إضافة رقم التسجيل الضريبي وعنوان الفاتورة|Добавить налоговый номер и платёжный адрес|Ajouter mon numéro fiscal et mon adresse de facturation|میرا ٹیکس نمبر اور بلنگ پتہ شامل کریں|मेरा कर नंबर और बिलिंग पता जोड़ें|添加税号和账单地址
field.select|Select…|اختر…|Выберите…|Sélectionner…|منتخب کریں…|चुनें…|请选择…
action.find|Find rates|ابحث عن الأسعار|Найти тарифы|Rechercher les tarifs|نرخ تلاش کریں|दरें खोजें|查询运价
action.modify|Modify search|تعديل البحث|Изменить поиск|Modifier la recherche|تلاش میں تبدیلی|खोज बदलें|修改搜索
action.preview|Preview booking|معاينة الحجز|Предпросмотр бронирования|Aperçu de réservation|بکنگ کا پیش منظر|बुकिंग पूर्वावलोकन|预览预订
action.estimate|Estimate PDF|تقدير بصيغة PDF|Расчёт в PDF|Estimation PDF|تخمینہ PDF|अनुमान PDF|估价PDF
action.quotation|Get official quotation|احصل على عرض سعر رسمي|Получить официальное предложение|Obtenir un devis officiel|باضابطہ کوٹیشن حاصل کریں|आधिकारिक कोटेशन प्राप्त करें|获取正式报价
action.quick|Quick quote|عرض سعر سريع|Быстрый расчёт|Devis rapide|فوری کوٹیشن|त्वरित कोटेशन|快速报价
booking.title|Your booking|حجزك|Ваше бронирование|Votre réservation|آپ کی بکنگ|आपकी बुकिंग|您的预订
booking.details|01 Details|01 التفاصيل|01 Данные|01 Informations|01 تفصیلات|01 विवरण|01 详细信息
booking.review|02 Review|02 المراجعة|02 Проверка|02 Vérification|02 جائزہ|02 समीक्षा|02 核对
booking.submitstep|03 Submit|03 الإرسال|03 Отправка|03 Envoi|03 جمع کریں|03 सबमिट करें|03 提交
booking.none|No account needed to search|البحث لا يتطلب حسابًا|Для поиска аккаунт не нужен|Recherche sans compte|تلاش کے لیے اکاؤنٹ ضروری نہیں|खोजने के लिए खाते की आवश्यकता नहीं|查询无需注册
booking.options|Shipping options|خيارات الشحن|Варианты перевозки|Options d’expédition|شپنگ کے اختیارات|शिपिंग विकल्प|运输方案
booking.recommended|Recommended option|الخيار المقترح|Предлагаемый вариант|Option proposée|تجویز کردہ آپشن|सुझाया गया विकल्प|推荐方案
booking.alternative|Alternative option|خيار بديل|Альтернативный вариант|Autre option|متبادل آپشن|वैकल्पिक विकल्प|备选方案
booking.pending|Rate pending|السعر قيد التأكيد|Тариф уточняется|Tarif en attente|نرخ کی تصدیق باقی ہے|दर की पुष्टि बाकी है|运价待确认
booking.confirmation|To be confirmed|سيتم التأكيد|Подлежит подтверждению|À confirmer|تصدیق ہونا باقی ہے|पुष्टि की जानी है|待确认
booking.space|Space: not confirmed|المساحة: غير مؤكدة|Место: не подтверждено|Place : non confirmée|جگہ: تصدیق نہیں ہوئی|जगह: पुष्टि नहीं हुई|舱位：未确认
booking.payment|Payment terms pending|شروط الدفع قيد التأكيد|Условия оплаты уточняются|Conditions de paiement en attente|ادائیگی کی شرائط کی تصدیق باقی ہے|भुगतान की शर्तें तय होना बाकी हैं|付款条件待确认
review.service|Service|الخدمة|Услуга|Service|سروس|सेवा|服务
review.route|Route|المسار|Маршрут|Liaison|راستہ|मार्ग|线路
review.customer|Customer|العميل|Клиент|Client|صارف|ग्राहक|客户
review.company|Company|الشركة|Компания|Entreprise|کمپنی|कंपनी|公司
review.goods|Goods|البضاعة|Товар|Marchandises|سامان|माल|货物
review.quantity|Quantity|الكمية|Количество|Quantité|مقدار|मात्रा|数量
review.rate|Rate|السعر|Тариф|Tarif|نرخ|दर|运价
review.documents|Documents|المستندات|Документы|Documents|دستاویزات|दस्तावेज़|文件
review.dimensions|Dimensions|الأبعاد|Размеры|Dimensions|ابعاد|आयाम|尺寸
soon.heading|We're getting this ready.|نعمل على تجهيز هذا القسم.|Мы готовим этот раздел.|Nous préparons cette rubrique.|ہم یہ سیکشن تیار کر رہے ہیں۔|हम इस भाग को तैयार कर रहे हैं।|此栏目正在筹备中。
soon.body|This section of the new UKR platform is coming soon. The existing website and dashboards have not been changed.|هذا القسم من منصة UKR الجديدة قادم قريبًا. لم يتم تغيير الموقع ولوحات التحكم الحالية.|Этот раздел новой платформы UKR скоро появится. Действующий сайт и панели не изменены.|Cette rubrique de la nouvelle plateforme UKR arrive bientôt. Le site et les tableaux de bord existants restent inchangés.|نئے UKR پلیٹ فارم کا یہ سیکشن جلد آ رہا ہے۔ موجودہ ویب سائٹ اور ڈیش بورڈز تبدیل نہیں کیے گئے۔|नए UKR प्लेटफ़ॉर्म का यह भाग जल्द आ रहा है। मौजूदा वेबसाइट और डैशबोर्ड नहीं बदले गए हैं।|UKR新平台的此栏目即将上线。现有网站和控制面板未作更改。
soon.back|Back to booking preview|العودة إلى معاينة الحجز|К предпросмотру бронирования|Retour à l’aperçu de réservation|بکنگ کے پیش منظر پر واپس جائیں|बुकिंग पूर्वावलोकन पर वापस जाएँ|返回预订预览
soon.quote|Need a quote now?|تحتاج إلى عرض سعر الآن؟|Нужен расчёт сейчас?|Besoin d’un devis maintenant ?|ابھی کوٹیشن چاہیے؟|अभी कोटेशन चाहिए?|现在需要报价？
soon.warning|Please use test details only. This preview does not save bookings or documents and does not take payments.|يرجى استخدام بيانات تجريبية فقط. هذه المعاينة لا تحفظ الحجوزات أو المستندات ولا تستقبل المدفوعات.|Используйте только тестовые данные. Предпросмотр не сохраняет бронирования и документы и не принимает оплату.|Utilisez uniquement des données de test. Cet aperçu ne conserve ni réservations ni documents et n’accepte aucun paiement.|صرف ٹیسٹ معلومات استعمال کریں۔ یہ پیش منظر بکنگ یا دستاویزات محفوظ نہیں کرتا اور ادائیگیاں قبول نہیں کرتا۔|केवल परीक्षण जानकारी का उपयोग करें। यह पूर्वावलोकन बुकिंग या दस्तावेज़ सहेजता नहीं है और भुगतान स्वीकार नहीं करता।|请仅使用测试信息。本预览不保存预订或文件，也不收取付款。
`.trim().split('\n').map(line => line.split('|'));
export function addDraftCopy(catalog,sourceKeys) {
  for (const [key,...values] of rows) {
    if(values.length!==7 || values.some(value=>!value.trim())) throw new Error('Incomplete draft translation: '+key);
    columns.forEach((locale,i)=>{catalog[locale] ||= {};catalog[locale][key]=values[i];});
    sourceKeys[values[0]]=key;
  }
}
