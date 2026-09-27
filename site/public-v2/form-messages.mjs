import {messages,languages} from './messages.mjs';
const rows=`
AIR_EXPRESS|Air cargo express|الشحن الجوي السريع|特快空运|Fret aérien express|Экспресс-авиадоставка|ایکسپریس ایئر کارگو|एक्सप्रेस एयर कार्गो
airEconomy|Air cargo economy|الشحن الجوي الاقتصادي|经济空运|Fret aérien économique|Экономичная авиадоставка|اکانومی ایئر کارگو|इकॉनमी एयर कार्गो
deliveryZone|Delivery city / collection|مدينة التوصيل / الاستلام|送货城市／自提|Ville de livraison / retrait|Город доставки / самовывоз|ڈیلیوری شہر / خود وصولی|डिलीवरी शहर / स्वयं संग्रह
chooseDelivery|Choose the delivery area|اختر منطقة التوصيل|选择送货区域|Choisir la zone de livraison|Выберите район доставки|ڈیلیوری کا علاقہ منتخب کریں|डिलीवरी क्षेत्र चुनें
dubai|Dubai city limits|داخل حدود مدينة دبي|迪拜市区|Ville de Dubaï|В черте Дубая|دبئی شہر کی حدود|दुबई शहर की सीमा
sharjah|Sharjah city|مدينة الشارقة|沙迦市区|Ville de Sharjah|Город Шарджа|شارجہ شہر|शारजाह शहर
ajman|Ajman city|مدينة عجمان|阿治曼市区|Ville d’Ajman|Город Аджман|عجمان شہر|अजमान शहर
uaq|Umm Al Quwain city|مدينة أم القيوين|乌姆盖万市区|Ville d’Umm Al Quwain|Город Умм-эль-Кайвайн|ام القوین شہر|उम्म अल क्वैन शहर
rak|Ras Al Khaimah city|مدينة رأس الخيمة|哈伊马角市区|Ville de Ras Al Khaimah|Город Рас-эль-Хайма|راس الخیمہ شہر|रास अल खैमा शहर
abudhabi|Abu Dhabi city|مدينة أبوظبي|阿布扎比市区|Ville d’Abu Dhabi|Город Абу-Даби|ابوظہبی شہر|अबू धाबी शहर
alain|Al Ain city|مدينة العين|艾因市区|Ville d’Al Ain|Город Эль-Айн|العین شہر|अल ऐन शहर
collection|Free collection: Ras Al Khor, Dubai|استلام مجاني: رأس الخور، دبي|免费自提：迪拜拉斯阿尔霍尔|Retrait gratuit : Ras Al Khor, Dubaï|Бесплатный самовывоз: Рас-эль-Хор, Дубай|مفت خود وصولی: راس الخور، دبئی|निःशुल्क संग्रह: रास अल खोर, दुबई
otherDelivery|Free zone / restricted area / outside city — confirm price|منطقة حرة / مقيّدة / خارج المدينة — السعر يحتاج تأكيدًا|自贸区／受限区域／市区外——费用待确认|Zone franche / accès restreint / hors ville — prix à confirmer|Свободная зона / ограниченный доступ / за городом — цена по запросу|فری زون / محدود علاقہ / شہر سے باہر — نرخ کی تصدیق|फ्री ज़ोन / प्रतिबंधित क्षेत्र / शहर से बाहर — शुल्क की पुष्टि
deliveryPackages|Number of boxes / packages|عدد الصناديق / الطرود|箱数／件数|Nombre de colis|Количество мест / коробок|ڈبوں / پیکجوں کی تعداد|बक्सों / पैकेजों की संख्या
deliveryRule|Single-box delivery applies only to air shipments under 25 kg gross. Other shipments use CBM bands. Ground-level cargo handover only.|سعر الصندوق الواحد للشحن الجوي فقط بوزن إجمالي أقل من 25 كغ. الشحنات الأخرى حسب شرائح الحجم. التسليم عند مدخل المبنى فقط.|单箱送货价仅适用于毛重低于25公斤的空运货件。其他货件按立方米档位计费，仅在地面层交货。|Le tarif un colis concerne uniquement l’aérien de moins de 25 kg brut. Les autres envois suivent les tranches en m³. Remise au rez-de-chaussée uniquement.|Тариф за одну коробку действует только для авиагруза массой брутто менее 25 кг. Остальные отправления — по объёму. Выдача на уровне земли.|ایک ڈبے کا نرخ صرف 25 کلوگرام سے کم مجموعی وزن والے ایئر کارگو کے لیے ہے۔ باقی شپمنٹس CBM سلیب کے مطابق ہیں۔ سامان گراؤنڈ لیول پر دیا جائے گا۔|एक बक्से का शुल्क केवल 25 किलोग्राम से कम सकल वजन वाले हवाई माल के लिए है। बाकी शिपमेंट पर CBM स्लैब लागू हैं। सुपुर्दगी केवल भूतल पर होगी।
sensitive|Sensitive cargo|بضائع حساسة|敏感货物|Marchandises sensibles|Чувствительный груз|حساس سامان|संवेदनशील माल
extraCare|Extra care / cosmetics|عناية إضافية / مستحضرات تجميل|特殊护理／化妆品|Soins particuliers / cosmétiques|Особый уход / косметика|اضافی احتیاط / کاسمیٹکس|अतिरिक्त देखभाल / कॉस्मेटिक्स
sensitiveFee|Sensitive / battery surcharge per chargeable kg|إضافة البضائع الحساسة / البطاريات لكل كغ خاضع للشحن|敏感货物／电池附加费，每计费公斤|Supplément sensible / batterie par kg taxable|Доплата за чувствительный груз / батареи за расчётный кг|حساس سامان / بیٹری کا فی چارج ایبل کلو اضافی چارج|संवेदनशील माल / बैटरी अधिभार प्रति प्रभार्य किग्रा
careFee|Extra care / cosmetics surcharge per chargeable kg|إضافة العناية / التجميل لكل كغ خاضع للشحن|特殊护理／化妆品附加费，每计费公斤|Supplément soins / cosmétiques par kg taxable|Доплата за особый уход / косметику за расчётный кг|اضافی احتیاط / کاسمیٹکس کا فی چارج ایبل کلو اضافی چارج|अतिरिक्त देखभाल / कॉस्मेटिक्स अधिभार प्रति प्रभार्य किग्रा
delivery|Local cargo delivery|توصيل البضائع محليًا|本地货物配送|Livraison locale du fret|Местная доставка груза|مقامی کارگو ڈیلیوری|स्थानीय माल डिलीवरी
transit|Estimated transit (days)|مدة النقل التقديرية (أيام)|预计运输时间（天）|Transit estimé (jours)|Ориентировочный транзит (дни)|تخمینی ٹرانزٹ (دن)|अनुमानित परिवहन समय (दिन)
stock|Route containers in hand (all sizes)|حاويات المسار المتاحة (كل الأحجام)|该路线可用集装箱（所有尺寸合计）|Conteneurs de la liaison (toutes tailles)|Контейнеры на маршруте (все размеры)|روٹ پر دستیاب کنٹینرز (تمام سائز)|मार्ग पर उपलब्ध कंटेनर (सभी आकार)
stockNote|Availability and shipping-order allocation require reconfirmation.|التوفر وتخصيص أمر الشحن يحتاجان إلى إعادة تأكيد.|可用量及配舱单分配需再次确认。|Disponibilité et attribution de l’ordre de transport à reconfirmer.|Наличие и выделение shipping order требуют повторного подтверждения.|دستیابی اور شپنگ آرڈر کی الاٹمنٹ کی دوبارہ تصدیق ضروری ہے۔|उपलब्धता और शिपिंग ऑर्डर आवंटन की दोबारा पुष्टि आवश्यक है।
tier5|Up to 5 CBM|حتى 5 متر مكعب|不超过5立方米|Jusqu’à 5 m³|До 5 м³|5 CBM تک|5 CBM तक
tier10|Above 5 to 10 CBM|أكثر من 5 وحتى 10 متر مكعب|超过5至10立方米|Plus de 5 à 10 m³|Свыше 5 до 10 м³|5 سے زیادہ، 10 CBM تک|5 से अधिक, 10 CBM तक
tier20|Above 10 to 20 CBM|أكثر من 10 وحتى 20 متر مكعب|超过10至20立方米|Plus de 10 à 20 m³|Свыше 10 до 20 м³|10 سے زیادہ، 20 CBM تک|10 से अधिक, 20 CBM तक
tierAbove20|Above 20 CBM|أكثر من 20 متر مكعب|超过20立方米|Plus de 20 m³|Свыше 20 м³|20 CBM سے زیادہ|20 CBM से अधिक
skipContent|Skip to content|انتقل إلى المحتوى|跳至正文|Aller au contenu|Перейти к содержимому|مواد پر جائیں|मुख्य सामग्री पर जाएँ
otherService|Need a different service? Send your cargo details for a tailored quotation.|هل تحتاج إلى خدمة أخرى؟ أرسل تفاصيل بضاعتك للحصول على عرض سعر مخصص.|需要其他服务？请提交货物信息，获取定制报价。|Besoin d’un autre service ? Envoyez les détails de votre marchandise pour un devis adapté.|Нужна другая услуга? Отправьте сведения о грузе для индивидуального расчёта.|کسی اور سروس کی ضرورت ہے؟ اپنی ضرورت کے مطابق نرخ حاصل کرنے کے لیے سامان کی تفصیلات بھیجیں۔|कोई दूसरी सेवा चाहिए? अपनी ज़रूरत के अनुसार कोटेशन पाने के लिए माल का विवरण भेजें।
shipping|Shipping estimate|تقدير الشحن|运费估算|Estimation d’expédition|Расчёт перевозки|شپنگ کا تخمینہ|शिपिंग अनुमान
allModes|Compare air and sea|قارن الجو والبحر|比较空运与海运|Comparer air et mer|Сравнить авиа и море|ایئر اور سمندر کا موازنہ|हवाई और समुद्री तुलना
mode|Transport mode|وسيلة النقل|运输方式|Mode de transport|Вид перевозки|ٹرانسپورٹ کا طریقہ|परिवहन का तरीका
cargoType|Cargo type|نوع البضاعة|货物类型|Type de fret|Тип груза|سامان کی قسم|माल का प्रकार
cartons|Cartons / boxes|كراتين / صناديق|纸箱／箱件|Cartons / caisses|Коробки / ящики|کارٹن / ڈبے|कार्टन / बक्से
pallets|Pallets|منصات تحميل|托盘|Palettes|Паллеты|پیلٹ|पैलेट
container|Full container|حاوية كاملة|整箱|Conteneur complet|Полный контейнер|مکمل کنٹینر|पूरा कंटेनर
otherCargo|Other commercial cargo|بضائع تجارية أخرى|其他商业货物|Autre fret commercial|Другой коммерческий груз|دیگر تجارتی سامان|अन्य वाणिज्यिक माल
weight|Gross weight (kg)|الوزن الإجمالي (كغ)|毛重（千克）|Poids brut (kg)|Вес брутто (кг)|مجموعی وزن (کلوگرام)|कुल वजन (किग्रा)
volume|Volume (CBM)|الحجم (متر مكعب)|体积（立方米）|Volume (m³)|Объём (м³)|حجم (CBM)|आयतन (CBM)
equipment|Container size|حجم الحاوية|箱型|Type de conteneur|Размер контейнера|کنٹینر کا سائز|कंटेनर का आकार
containerCount|Number of containers|عدد الحاويات|集装箱数量|Nombre de conteneurs|Количество контейнеров|کنٹینروں کی تعداد|कंटेनरों की संख्या
exwCheck|Include EXW pickup and export customs|أضف استلام EXW وجمارك التصدير|包含 EXW 提货及出口报关|Inclure enlèvement EXW et douane export|Включить забор EXW и экспортное оформление|EXW پک اَپ اور ایکسپورٹ کسٹمز شامل کریں|EXW पिकअप और निर्यात कस्टम्स शामिल करें
doorCheck|Request local delivery|اطلب التوصيل المحلي|申请本地配送|Demander la livraison locale|Запросить местную доставку|مقامی ڈیلیوری مطلوب ہے|स्थानीय डिलीवरी का अनुरोध
flexCheck|My cargo-ready date is flexible|تاريخ جاهزية البضاعة مرن|备货日期可灵活调整|Ma date de disponibilité est flexible|Дата готовности может измениться|سامان کی تیاری کی تاریخ میں لچک ہے|माल तैयार होने की तारीख लचीली है
options|Your shipping options|خيارات شحنتك|您的运输方案|Vos options d’expédition|Варианты перевозки|آپ کے شپنگ آپشنز|आपके शिपिंग विकल्प
loading|Checking available rates…|جارٍ التحقق من الأسعار المتاحة…|正在查询可用运价…|Recherche des tarifs disponibles…|Проверяем доступные тарифы…|دستیاب نرخ دیکھ رہے ہیں…|उपलब्ध दरें जाँची जा रही हैं…
unavailable|We could not load rates. Please try again or send an enquiry.|تعذّر تحميل الأسعار. حاول مجددًا أو أرسل استفسارًا.|暂时无法加载运价。请重试或提交询价。|Impossible de charger les tarifs. Réessayez ou envoyez une demande.|Не удалось загрузить тарифы. Повторите попытку или отправьте запрос.|نرخ لوڈ نہیں ہوئے۔ دوبارہ کوشش کریں یا درخواست بھیجیں۔|दरें लोड नहीं हो सकीं। फिर कोशिश करें या अनुरोध भेजें।
noRate|No published rate for this route and date.|لا توجد تعرفة منشورة لهذا المسار والتاريخ.|该路线和日期暂无已公布运价。|Aucun tarif publié pour cette liaison et cette date.|Для этого маршрута и даты нет опубликованного тарифа.|اس روٹ اور تاریخ کے لیے شائع شدہ نرخ نہیں۔|इस मार्ग और तारीख के लिए प्रकाशित दर नहीं है।
requestQuote|Request a quotation|اطلب عرض سعر|申请报价|Demander un devis|Запросить расчёт|کوٹیشن کی درخواست|कोटेशन का अनुरोध करें
fromPrice|Starting from|ابتداءً من|起价|À partir de|От|شروع از|शुरुआती कीमत
minimum|Minimum|الحد الأدنى|最低|Minimum|Минимум|کم از کم|न्यूनतम
validUntil|Valid until|صالح حتى|有效期至|Valable jusqu’au|Действует до|اس تاریخ تک مؤثر|इस तारीख तक मान्य
estimate|Estimate|تقدير|估价|Estimation|Оценка|تخمینہ|अनुमान
approval|Subject to approval|خاضع للموافقة|须经审核|Sous réserve d’accord|Требуется согласование|منظوری سے مشروط|मंज़ूरी के अधीन
continue|Continue with this service|تابع بهذه الخدمة|选择此服务并继续|Continuer avec ce service|Продолжить с этой услугой|اس سروس کے ساتھ آگے بڑھیں|इस सेवा के साथ आगे बढ़ें
included|Included|المشمول|包含项目|Inclus|Включено|شامل|शामिल
excluded|Excluded|غير المشمول|不含项目|Exclus|Не включено|غیر شامل|शामिल नहीं
terms|Tariff terms|شروط التعرفة|运价条款|Conditions tarifaires|Условия тарифа|نرخ کی شرائط|टैरिफ की शर्तें
originalTerms|Original tariff wording supplied by UKR|النص الأصلي لشروط التعرفة من UKR|UKR 提供的原始运价条款|Libellé tarifaire original fourni par UKR|Исходные условия тарифа от UKR|UKR کی فراہم کردہ اصل شرائط|UKR द्वारा दिए गए मूल टैरिफ शब्द
reviewCargo|Tell us about your cargo|أخبرنا عن بضاعتك|填写货物资料|Décrivez votre marchandise|Расскажите о грузе|اپنے سامان کے بارے میں بتائیں|अपने माल के बारे में बताएँ
commodity|Goods description|وصف البضاعة|品名及描述|Description des marchandises|Описание товара|سامان کی تفصیل|माल का विवरण
packages|Number of packages|عدد الطرود|件数|Nombre de colis|Количество мест|پیکج کی تعداد|पैकेज की संख्या
declaredValue|Goods value (AED, optional)|قيمة البضاعة (درهم، اختياري)|货值（AED，选填）|Valeur (AED, facultatif)|Стоимость (AED, необязательно)|مالیت (AED، اختیاری)|माल का मूल्य (AED, वैकल्पिक)
dimensions|Package dimensions (optional)|أبعاد الطرود (اختياري)|包装尺寸（选填）|Dimensions des colis (facultatif)|Размеры мест (необязательно)|پیکج کا سائز (اختیاری)|पैकेज के माप (वैकल्पिक)
stackable|Cargo can be stacked|يمكن تكديس البضاعة|货物可堆叠|Fret gerbable|Груз можно штабелировать|سامان ایک دوسرے پر رکھا جا سکتا ہے|माल को एक के ऊपर एक रखा जा सकता है
batteries|Contains batteries|يحتوي على بطاريات|含电池|Contient des batteries|Содержит батареи|بیٹریاں شامل ہیں|बैटरी शामिल हैं
dangerous|Dangerous or restricted goods|بضائع خطرة أو مقيّدة|危险品或受限货物|Marchandises dangereuses ou réglementées|Опасный или ограниченный груз|خطرناک یا محدود سامان|खतरनाक या प्रतिबंधित माल
oversized|Heavy or oversized cargo|بضاعة ثقيلة أو كبيرة الحجم|超重或超尺寸货物|Fret lourd ou hors gabarit|Тяжеловесный или негабаритный груз|بھاری یا غیر معمولی سائز کا سامان|भारी या बड़े आकार का माल
specialNote|Special cargo requires a staff review before price or acceptance is confirmed.|تحتاج البضائع الخاصة إلى مراجعة الموظفين قبل تأكيد السعر أو القبول.|特殊货物须经团队审核后方可确认价格及承运。|Le fret spécial nécessite une vérification avant confirmation du prix ou de l’acceptation.|Особый груз требует проверки сотрудниками до подтверждения цены и приёмки.|خاص سامان کے نرخ یا قبولیت کی تصدیق سے پہلے عملے کا جائزہ ضروری ہے۔|विशेष माल की कीमत या स्वीकृति की पुष्टि से पहले टीम की समीक्षा आवश्यक है।
pickupAddress|Supplier / pickup address (optional)|عنوان المورد / الاستلام (اختياري)|供应商／提货地址（选填）|Adresse fournisseur / enlèvement (facultatif)|Адрес поставщика / забора (необязательно)|سپلائر / پک اَپ کا پتہ (اختیاری)|सप्लायर / पिकअप पता (वैकल्पिक)
deliveryAddress|Delivery address (optional)|عنوان التوصيل (اختياري)|送货地址（选填）|Adresse de livraison (facultatif)|Адрес доставки (необязательно)|ڈیلیوری کا پتہ (اختیاری)|डिलीवरी पता (वैकल्पिक)
notes|Other requirements (optional)|متطلبات أخرى (اختياري)|其他要求（选填）|Autres besoins (facultatif)|Другие требования (необязательно)|دیگر ضروریات (اختیاری)|अन्य ज़रूरतें (वैकल्पिक)
name|Your name|اسمك|您的姓名|Votre nom|Ваше имя|آپ کا نام|आपका नाम
company|Company (optional)|الشركة (اختياري)|公司名称（选填）|Entreprise (facultatif)|Компания (необязательно)|کمپنی (اختیاری)|कंपनी (वैकल्पिक)
email|Email address|البريد الإلكتروني|电子邮箱|Adresse e-mail|Электронная почта|ای میل|ईमेल पता
phone|Phone / WhatsApp (optional)|الهاتف / واتساب (اختياري)|电话／WhatsApp（选填）|Téléphone / WhatsApp (facultatif)|Телефон / WhatsApp (необязательно)|فون / واٹس ایپ (اختیاری)|फ़ोन / WhatsApp (वैकल्पिक)
review|Review request|راجع الطلب|核对请求|Vérifier la demande|Проверить запрос|درخواست کا جائزہ|अनुरोध की समीक्षा
edit|Edit details|عدّل التفاصيل|修改信息|Modifier les détails|Изменить данные|تفصیل میں ترمیم|विवरण बदलें
submit|Submit booking request|أرسل طلب الحجز|提交订舱请求|Envoyer la demande de réservation|Отправить заявку на перевозку|بکنگ کی درخواست بھیجیں|बुकिंग अनुरोध भेजें
consent|I agree to send these cargo and contact details to UKR to handle my enquiry.|أوافق على إرسال تفاصيل البضاعة وبيانات التواصل هذه إلى UKR لمعالجة استفساري.|我同意将这些货物及联系方式提交给 UKR，以处理本次询价。|J’accepte de transmettre ces informations de fret et de contact à UKR pour traiter ma demande.|Я согласен передать UKR сведения о грузе и контакты для обработки запроса.|میں اس درخواست کے لیے سامان اور رابطے کی یہ معلومات UKR کو بھیجنے پر رضامند ہوں۔|मैं अपना अनुरोध सँभालने के लिए माल और संपर्क की यह जानकारी UKR को भेजने के लिए सहमत हूँ।
sending|Sending your request…|جارٍ إرسال طلبك…|正在提交请求…|Envoi de votre demande…|Отправляем запрос…|آپ کی درخواست بھیج رہے ہیں…|आपका अनुरोध भेजा जा रहा है…
received|Booking request received|تم استلام طلب الحجز|已收到订舱请求|Demande de réservation reçue|Заявка получена|بکنگ کی درخواست موصول ہوگئی|बुकिंग अनुरोध प्राप्त हुआ
accepted|UKR booking accepted|تم قبول الحجز لدى UKR|UKR 已接受订舱|Réservation acceptée par UKR|Заявка принята UKR|UKR نے بکنگ قبول کر لی|UKR ने बुकिंग स्वीकार कर ली
pending|Staff confirmation is pending. Keep this reference for follow-up.|بانتظار تأكيد الفريق. احتفظ بهذا المرجع للمتابعة.|正在等待团队确认，请保留此编号以便查询。|Confirmation de notre équipe en attente. Conservez cette référence.|Ожидается подтверждение команды. Сохраните номер для связи.|عملے کی تصدیق باقی ہے۔ رابطے کے لیے یہ حوالہ محفوظ رکھیں۔|टीम की पुष्टि बाकी है। आगे संपर्क के लिए यह संदर्भ सुरक्षित रखें।
acceptedText|Your request is accepted by UKR. Carrier allocation and cargo verification follow.|قبلت UKR طلبك. يلي ذلك تخصيص الناقل والتحقق من البضاعة.|UKR 已接受您的请求，后续将安排承运分配及货物核验。|UKR a accepté votre demande. L’affectation du transporteur et la vérification du fret suivent.|UKR приняла запрос. Далее — выделение перевозчика и проверка груза.|UKR نے درخواست قبول کر لی ہے۔ کیریئر کی تخصیص اور سامان کی جانچ اگلے مراحل ہیں۔|UKR ने अनुरोध स्वीकार कर लिया है। कैरियर का आवंटन और माल की जाँच आगे होगी।
reference|Reference|المرجع|参考编号|Référence|Номер|حوالہ|संदर्भ
responseTarget|Confirmation target|الوقت المستهدف للتأكيد|预计确认时间|Objectif de confirmation|Плановое время подтверждения|تصدیق کا متوقع وقت|पुष्टि का लक्षित समय
saveDraft|Save draft on this device|احفظ مسودة على هذا الجهاز|在本设备保存草稿|Enregistrer sur cet appareil|Сохранить черновик на устройстве|اس ڈیوائس پر مسودہ محفوظ کریں|इस डिवाइस पर ड्राफ़्ट सेव करें
saved|Draft saved on this device. It has not been submitted.|حُفظت المسودة على هذا الجهاز ولم تُرسل.|草稿已保存在本设备，尚未提交。|Brouillon enregistré sur cet appareil, non envoyé.|Черновик сохранён на устройстве и не отправлен.|مسودہ اس ڈیوائس پر محفوظ ہے، بھیجا نہیں گیا۔|ड्राफ़्ट इस डिवाइस पर सेव हुआ है, भेजा नहीं गया।
restoreDraft|Continue saved draft|تابع المسودة المحفوظة|继续已保存的草稿|Reprendre le brouillon|Продолжить черновик|محفوظ مسودہ جاری رکھیں|सेव किया ड्राफ़्ट जारी रखें
draftUnavailable|No saved draft is available on this device.|لا توجد مسودة محفوظة على هذا الجهاز.|本设备上没有可用草稿。|Aucun brouillon sur cet appareil.|На устройстве нет черновика.|اس ڈیوائس پر کوئی محفوظ مسودہ نہیں۔|इस डिवाइस पर कोई सेव किया ड्राफ़्ट नहीं है।
print|Print / save PDF|اطبع / احفظ PDF|打印／保存 PDF|Imprimer / enregistrer en PDF|Печать / сохранить PDF|پرنٹ / PDF محفوظ کریں|प्रिंट / PDF सेव करें
validation|Please complete this field with a valid value.|يرجى إكمال هذا الحقل بقيمة صحيحة.|请在此字段填写有效内容。|Veuillez saisir une valeur valide.|Введите корректное значение.|براہِ کرم اس خانے میں درست معلومات بھریں۔|कृपया इस फ़ील्ड में सही मान भरें।
retry|Please check your details and try again.|راجع بياناتك وحاول مجددًا.|请核对信息后重试。|Vérifiez les informations et réessayez.|Проверьте данные и повторите.|تفصیل دیکھ کر دوبارہ کوشش کریں۔|विवरण जाँचें और फिर कोशिश करें।
rateChanged|The rate changed or expired. Search again before submitting.|تغيّرت التعرفة أو انتهت صلاحيتها. ابحث مجددًا قبل الإرسال.|运价已变更或到期，请重新查询后再提交。|Le tarif a changé ou expiré. Relancez la recherche avant l’envoi.|Тариф изменился или истёк. Повторите поиск перед отправкой.|نرخ بدل گیا یا ختم ہوگیا۔ بھیجنے سے پہلے دوبارہ تلاش کریں۔|दर बदल गई या समाप्त हो गई है। भेजने से पहले फिर खोजें।
tooMany|Too many requests. Please try again later.|طلبات كثيرة. حاول مجددًا لاحقًا.|请求过于频繁，请稍后再试。|Trop de demandes. Réessayez plus tard.|Слишком много запросов. Повторите позже.|درخواستیں بہت زیادہ ہیں۔ کچھ دیر بعد کوشش کریں۔|बहुत अधिक अनुरोध हैं। थोड़ी देर बाद कोशिश करें।
routeSelect|Choose a route|اختر المسار|选择路线|Choisissez une liaison|Выберите маршрут|روٹ منتخب کریں|मार्ग चुनें
currency|Currency|العملة|币种|Devise|Валюта|کرنسی|मुद्रा
itemCost|Buying cost per item|تكلفة شراء القطعة|单件采购成本|Coût d’achat unitaire|Закупочная стоимость единицы|فی آئٹم خریداری کی لاگت|प्रति वस्तु खरीद लागत
quantity|Number of items|عدد القطع|商品数量|Nombre d’articles|Количество единиц|آئٹمز کی تعداد|वस्तुओं की संख्या
length|Packed length (cm)|الطول مع التغليف (سم)|包装后长度（厘米）|Longueur emballée (cm)|Длина с упаковкой (см)|پیک شدہ لمبائی (سینٹی میٹر)|पैक की हुई लंबाई (सेमी)
width|Packed width (cm)|العرض مع التغليف (سم)|包装后宽度（厘米）|Largeur emballée (cm)|Ширина с упаковкой (см)|پیک شدہ چوڑائی (سینٹی میٹر)|पैक की हुई चौड़ाई (सेमी)
height|Packed height (cm)|الارتفاع مع التغليف (سم)|包装后高度（厘米）|Hauteur emballée (cm)|Высота с упаковкой (см)|پیک شدہ اونچائی (سینٹی میٹر)|पैक की हुई ऊँचाई (सेमी)
itemWeight|Packed weight per item (kg)|وزن القطعة مع التغليف (كغ)|单件包装后重量（千克）|Poids emballé unitaire (kg)|Вес единицы с упаковкой (кг)|فی آئٹم پیک شدہ وزن (کلوگرام)|प्रति वस्तु पैक किया वजन (किग्रा)
selling|Selling price per item (optional)|سعر بيع القطعة (اختياري)|单件售价（选填）|Prix de vente unitaire (facultatif)|Цена продажи единицы (необязательно)|فی آئٹم فروخت کی قیمت (اختیاری)|प्रति वस्तु बिक्री मूल्य (वैकल्पिक)
extras|Other costs for the whole shipment|التكاليف الأخرى للشحنة كاملة|整票货物的其他成本|Autres coûts pour l’envoi complet|Прочие расходы на всю отправку|پوری شپمنٹ کے دیگر اخراجات|पूरे शिपमेंट की अन्य लागत
calculate|Calculate|احسب|计算|Calculer|Рассчитать|حساب کریں|गणना करें
shippedCost|Estimated cost per item including freight|تكلفة القطعة التقديرية مع الشحن|含运费的单件预计成本|Coût unitaire estimé, transport compris|Оценка стоимости единицы с доставкой|فریٹ سمیت فی آئٹم تخمینی لاگت|भाड़े सहित प्रति वस्तु अनुमानित लागत
profit|Estimated profit per item|الربح التقديري للقطعة|单件预计利润|Bénéfice unitaire estimé|Оценка прибыли на единицу|فی آئٹم تخمینی منافع|प्रति वस्तु अनुमानित लाभ
fill|Container capacity used|نسبة سعة الحاوية المستخدمة|集装箱容量使用率|Capacité du conteneur utilisée|Использование вместимости контейнера|کنٹینر کی استعمال شدہ گنجائش|कंटेनर की उपयोग की गई क्षमता
noMagic|No matching published tariff in this currency and date. Request a quotation for your cargo.|لا توجد تعرفة منشورة مطابقة للعملة والتاريخ. اطلب عرض سعر لبضاعتك.|该币种和日期暂无匹配的已公布运价，请为您的货物申请报价。|Aucun tarif publié pour cette devise et cette date. Demandez un devis.|Нет подходящего тарифа в этой валюте на эту дату. Запросите расчёт.|اس کرنسی اور تاریخ کے مطابق شائع شدہ نرخ نہیں۔ سامان کے لیے کوٹیشن مانگیں۔|इस मुद्रा और तारीख के लिए प्रकाशित दर नहीं है। माल के लिए कोटेशन माँगें।
AIR|Air cargo|شحن جوي|空运|Fret aérien|Авиаперевозка|ایئر کارگو|हवाई कार्गो
LCL|Shared-container freight (LCL)|شحن جزئي (LCL)|拼箱运输（LCL）|Groupage maritime (LCL)|Сборный морской груз (LCL)|مشترکہ کنٹینر (LCL)|साझा कंटेनर माल (LCL)
LCL_DDP|Warehouse-to-UAE LCL*|شحن جزئي من المستودع إلى الإمارات*|中国仓至阿联酋拼箱*|Groupage entrepôt–Émirats*|Сборный груз со склада в ОАЭ*|گودام سے امارات LCL*|वेयरहाउस से यूएई LCL*
FCL20|20ft container|حاوية 20 قدم|20尺集装箱|Conteneur 20 pieds|Контейнер 20 футов|20 فٹ کنٹینر|20 फ़ुट कंटेनर
FCL40|40ft DC / HC|40 قدم DC / HC|40尺普柜／高柜|40 pieds DC / HC|40 футов DC / HC|40 فٹ DC / HC|40 फ़ुट DC / HC
FCL40HC|40ft high cube|حاوية مرتفعة 40 قدم|40尺高柜|40 pieds high cube|40 футов High Cube|40 فٹ ہائی کیوب|40 फ़ुट हाई क्यूब
FCL45|45ft container|حاوية 45 قدم|45尺集装箱|Conteneur 45 pieds|Контейнер 45 футов|45 فٹ کنٹینر|45 फ़ुट कंटेनर
AIR_DDP|Air cargo with delivery*|شحن جوي مع التوصيل*|空运配送服务*|Fret aérien avec livraison*|Авиадоставка до получателя*|ڈیلیوری کے ساتھ ایئر کارگو*|डिलीवरी सहित हवाई कार्गो*
ROAD_LTL|Shared truck|شاحنة مشتركة|零担卡车运输|Groupage routier|Сборный автогруз|مشترکہ ٹرک|साझा ट्रक
unitKg|kg|كغ|千克|kg|кг|کلوگرام|किग्रा
unitCbm|CBM|م³|立方米|m³|м³|CBM|CBM
unitContainer|container|حاوية|箱|conteneur|контейнер|کنٹینر|कंटेनर
freight|Freight|أجرة الشحن|运费|Fret|Перевозка|فریٹ|भाड़ा
originFee|Origin charges|رسوم المنشأ|起运地费用|Frais à l’origine|Сборы отправления|روانگی کے چارجز|प्रस्थान शुल्क
destinationFee|Destination charges|رسوم الوصول|目的地费用|Frais à destination|Сборы назначения|منزل کے چارجز|गंतव्य शुल्क
documents|Documentation|المستندات|文件费|Documentation|Документы|دستاویزات|दस्तावेज़ शुल्क
yes|Yes|نعم|是|Oui|Да|جی ہاں|हाँ
no|No|لا|否|Non|Нет|نہیں|नहीं
`;
for(const line of rows.trim().split('\n')){const [key,...values]=line.split('|');if(values.length!==7)throw new Error('Translation columns: '+key);Object.keys(languages).forEach((l,i)=>messages[l][key]=values[i]);}
export {messages,languages};
export const cities={
Ningbo:['Ningbo','نينغبو','宁波','Ningbo','Нинбо','ننگبو','निंगबो'],
Guangzhou:['Guangzhou','قوانغتشو','广州','Guangzhou','Гуанчжоу','گوانگژو','ग्वांगझोउ'],
Nansha:['Nansha','نانشا','南沙','Nansha','Наньша','نانشا','नानशा'],
Shenzhen:['Shenzhen','شنتشن','深圳','Shenzhen','Шэньчжэнь','شینژن','शेन्ज़ेन'],
Shanghai:['Shanghai','شنغهاي','上海','Shanghai','Шанхай','شنگھائی','शंघाई'],
Qingdao:['Qingdao','تشينغداو','青岛','Qingdao','Циндао','چنگ ڈاؤ','छिंगदाओ'],
Tianjin:['Tianjin','تيانجين','天津','Tianjin','Тяньцзинь','تیانجن','तियानजिन'],
'Hong Kong':['Hong Kong','هونغ كونغ','香港','Hong Kong','Гонконг','ہانگ کانگ','हांगकांग'],
Beijing:['Beijing','بكين','北京','Pékin','Пекин','بیجنگ','बीजिंग'],
'Jebel Ali':['Jebel Ali','جبل علي','杰贝阿里','Jebel Ali','Джебель-Али','جبل علی','जेबेल अली'],
Dubai:['Dubai','دبي','迪拜','Dubaï','Дубай','دبئی','दुबई'],
China:['China','الصين','中国','Chine','Китай','چین','चीन'],
UAE:['UAE','الإمارات','阿联酋','Émirats','ОАЭ','امارات','यूएई']
};
export const city=(name,lang='en')=>cities[name]?.[Object.keys(languages).indexOf(lang)]||name;
export function canonicalPlace(name){
 const parts=String(name||'').trim().split(/[,،，]/).map(part=>part.trim());
 const translated=parts.map(part=>Object.entries(cities).find(([,names])=>names.some(n=>n.toLowerCase()===part.toLowerCase()))?.[0]||part);
 const place=translated[0];
 if(place==='Dubai')return 'Dubai';
 if(Object.keys(cities).slice(0,9).includes(place))return place+', China';
 if(place==='Jebel Ali')return place+', UAE';
 return translated.join(', ');
}
