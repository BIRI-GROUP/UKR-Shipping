import {messages} from '../../../site/public-v2/form-messages.mjs';
import interfaceCopy from '../../../preview/locales/interface.mjs';
import knowledgeCopy from '../../../preview/locales/knowledge.mjs';
import operationsCopy from '../../../preview/locales/operations.mjs';
import commonCopy from '../../../preview/locales/common.mjs';
import {rows as headerRows} from '../../../preview/header/copy.mjs';
import portalCopy from './portal-copy.mjs';
export const order=['en','ar','ru','fr','ur','hi','zh'];
const norm=s=>String(s).replace(/\s+/g,' ').trim();
const dictionaries=Object.fromEntries(order.map(l=>[l,{}]));
for(const [key,source]of Object.entries(messages.en)){if(typeof source!=='string')continue;for(const lang of order)if(typeof messages[lang]?.[key]==='string')dictionaries[lang][norm(source)]=messages[lang][key];}
const rows=[...headerRows,...[interfaceCopy,knowledgeCopy,operationsCopy,commonCopy,portalCopy].flatMap(copy=>copy.trim().split('\n').map(row=>row.split('|')))];
for(const row of rows){if(row.length!==7||row.some(s=>!s.trim()))throw Error('Missing portal translation: '+row[0]);order.forEach((lang,i)=>dictionaries[lang][norm(row[0])]=row[i].trim());}
const aliases={
 verification_requested:'Check your email for the verification code.',invalid_code:'Check the code or request a new one.',resend_wait:'Please wait before requesting another code.',too_many_requests:'Too many attempts. Please try again later.',
 invalid_input:'Please check the entered details.',invalid_decimal:'Please check the entered details.',required_field:'Complete this field.',unknown_field:'Please check the entered details.',invalid_or_conflicting_record:'Please check the entered details.',
 sign_in_required:'Your session has expired. Sign in again.',csrf_failed:'Your session has expired. Sign in again.',access_denied:'You do not have access to this action.',approval_not_allowed:'You do not have access to this action.',
 company_already_linked:'This email is already linked to a company account.',account_already_linked:'This email is already linked to a company account.',
 record_changed:'This record changed. Reload it before saving.',rate_changed:'This rate changed. Calculate again.',rate_unavailable:'No valid rate is available. Contact UKR.',service_unavailable:'Service unavailable. Please contact UKR.',module_not_available:'This service is not available. Contact UKR.',not_found:'Record not found.',wrong_portal:'Use the correct portal for this account.',
 company_not_approved:'Your company account requires UKR approval for restricted services.',email_delivery_disabled:'Email delivery is not configured. Contact UKR.',storage_unavailable:'Document storage is unavailable. Contact UKR.',
 'My shipments':'My Shipments','Customer Portal':'Customer portal','UKR portal':'Customer portal'
};
for(const [alias,source]of Object.entries(aliases))for(const lang of order)dictionaries[lang][alias]=dictionaries[lang][source]||source;
export function translate(lang,key){return dictionaries[order.includes(lang)?lang:'en'][key]??key;}
export function customerCopyMissing(sources){return sources.filter(source=>order.some(lang=>!dictionaries[lang][source]));}
export function browserBundle(){return 'window.UKRPortalMessages='+JSON.stringify(dictionaries).replaceAll('<','\\u003c').replaceAll(String.fromCharCode(8232),'\\u2028').replaceAll(String.fromCharCode(8233),'\\u2029')+';';}
