export const actions=Object.freeze(['view','create','edit','approve','delete','export']);
export const menu=Object.freeze([
 ['overview','Overview',1],['sales','Sales & Email',5],['air_ddp','Air DDP Consolidation',2],
 ['sea_ddp','Sea DDP Consolidation',3],['air_express','Air Express',3],['sea_lcl','LCL',3],['sea_fcl','FCL',4],
 ['land','Truck',4],['storage','Storage & Fulfilment',7],['customs','Customs Clearance',4],
 ['china_payment','China Payment Service',6],['purchase_rates','Purchase Rates',5],['delivery_rates','Delivery Rates',5],
 ['finance','Finance',6],['purchase_invoices','Purchase Invoices',6],['tasks','Task Center',1],
 ['delivery','Delivery & Collection',8],['hr','HR & Employees',8],['masters','Masters',1],['settings','Settings',1]
].map(([id,label,phase])=>Object.freeze({id,label,phase})));
export const extraModules=Object.freeze(['users','roles','templates','outbox','logs','preferences','themes','task_rules','approvals','exchange_rates','customers','mail_accounts']);
export const protectedModules=Object.freeze(['masters','users','roles','themes','task_rules','mail_accounts']);
export const newRoles=Object.freeze({warehouse:'Warehouse',driver:'Driver',purchase_team:'Purchase Team',currency_rate_user:'Currency Rate User',hr:'HR'});
export const statuses=Object.freeze(['suggested','open','in_progress','submitted','completed','dismissed','cancelled']);
export const eventTypes=Object.freeze(['booking.submitted','booking.accepted','goods.received','cargo.ready',
 'shipment.in_transit','shipment.status_stale','shipment.status_updated','shipment.eta_soon','invoice.overdue',
 'quotation.followup_due','quotation.responded','document.expiring','approval.requested','approval.waiting','approval.decided',
 'consolidation.suggested','manual.task','currency.rate_missing']);
export const publicDomains=Object.freeze(['gmail.com','googlemail.com','hotmail.com','outlook.com','live.com','yahoo.com','yahoo.co.uk','icloud.com','me.com','aol.com','proton.me','protonmail.com','mail.com','yandex.com','qq.com','163.com']);
export const serviceCodes=Object.freeze(['air_ddp','sea_ddp','air_express','sea_lcl','sea_fcl','land','storage','customs']);
