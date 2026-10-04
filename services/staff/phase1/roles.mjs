import {roles} from '../policy.mjs';
// Extend the existing registry, retaining its scrypt, invitation and recovery implementations.
export function extendLegacyRoles() {
 const assigned={read:'assigned',write:'assigned',create:true,approve:false};
 const additions={warehouse:{name:'Warehouse',purpose:'Work only at approved warehouse locations.',grants:{warehouse:assigned}},driver:{name:'Driver',purpose:'Work only on assigned deliveries.',grants:{transport:assigned}},purchase_team:{name:'Purchase Team',purpose:'Maintain authorised purchase rates and supplier invoices.',grants:{}},currency_rate_user:{name:'Currency Rate User',purpose:'Enter rates for specifically assigned currencies.',grants:{}},hr:{name:'HR',purpose:'Maintain employee records with HR permissions.',grants:{}}};
 for(const [key,value]of Object.entries(additions))if(!Object.hasOwn(roles,key))roles[key]=value;
 return roles;
}
