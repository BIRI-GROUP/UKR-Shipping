/* Language labels only. The private access form uses a native, same-origin POST. */
(function(){'use strict';
const order=['en','ar','ru','fr','ur','hi','zh'],names=['English','العربية','Русский','Français','اردو','हिन्दी','简体中文'];
const copy={
 en:['Language','Private test workspace','Enter your private access key to review the portals. Code 1234 alone does not unlock this workspace.','Private access key','Open workspace','Use test records only. No email is sent.'],
 ar:['اللغة','مساحة اختبار خاصة','أدخل مفتاح الوصول الخاص لمراجعة البوابتين. الرمز 1234 وحده لا يفتح مساحة العمل.','مفتاح الوصول الخاص','فتح مساحة العمل','استخدم بيانات اختبار فقط. لا تُرسل رسائل بريد إلكتروني.'],
 ru:['Язык','Закрытая тестовая среда','Введите личный ключ для проверки порталов. Одного кода 1234 недостаточно для доступа.','Личный ключ доступа','Открыть рабочую среду','Используйте только тестовые данные. Письма не отправляются.'],
 fr:['Langue','Espace de test privé','Saisissez votre clé privée pour tester les portails. Le code 1234 seul ne permet pas d’accéder à cet espace.','Clé d’accès privée','Ouvrir l’espace','Utilisez uniquement des données de test. Aucun e-mail n’est envoyé.'],
 ur:['زبان','نجی آزمائشی ورک اسپیس','پورٹلز آزمانے کے لیے نجی رسائی کی کلید درج کریں۔ صرف 1234 کوڈ سے رسائی نہیں ملتی۔','نجی رسائی کی کلید','ورک اسپیس کھولیں','صرف آزمائشی معلومات استعمال کریں۔ کوئی ای میل نہیں بھیجی جاتی۔'],
 hi:['भाषा','निजी परीक्षण कार्यक्षेत्र','पोर्टल जाँचने के लिए निजी प्रवेश कुंजी दर्ज करें। केवल 1234 कोड से प्रवेश नहीं मिलता।','निजी प्रवेश कुंजी','कार्यक्षेत्र खोलें','केवल परीक्षण डेटा का उपयोग करें। कोई ईमेल नहीं भेजा जाता।'],
 zh:['语言','私人测试工作区','请输入私人访问密钥来测试门户。仅凭 1234 代码无法进入工作区。','私人访问密钥','打开工作区','仅使用测试数据。系统不会发送电子邮件。']};
const $=id=>document.getElementById(id);
let lang=new URLSearchParams(location.search).get('lang')||(navigator.language||'en').split('-')[0];if(!order.includes(lang))lang='en';
const select=$('reviewLanguage');order.forEach((id,i)=>{const o=document.createElement('option');o.value=id;o.textContent=names[i]+' · '+id.toUpperCase();select.append(o);});select.value=lang;
function paint(){const v=copy[lang];document.documentElement.lang=lang;document.documentElement.dir=['ar','ur'].includes(lang)?'rtl':'ltr';['reviewLanguageLabel','reviewTitle','reviewIntro','reviewKeyLabel','reviewButton','reviewWarning'].forEach((id,i)=>$(id).textContent=v[i]);}
select.addEventListener('change',()=>{lang=select.value;paint();});paint();
})();
