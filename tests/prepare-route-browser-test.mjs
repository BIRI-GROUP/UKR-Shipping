// Only the disposable localhost fixture; never writes to the deployed site.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../services/staff/package.json',import.meta.url)),ExcelJS=require('exceljs');
const origin='http://127.0.0.1:4180';
const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'test-owner@example.test',password:'Local-test-only-482!'})});
if(!login.ok)throw Error('Local test fixture must be running.');
const cookie=login.headers.get('set-cookie').split(';')[0];
const download=await fetch(origin+'/api/rate-workbook',{headers:{Cookie:cookie}}),result=await download.json();
if(!download.ok)throw Error(result.error);
const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(result.base64,'base64'));
const ws=wb.getWorksheet('Rates');
for(let n=2;n<=ws.rowCount;n++) {const r=ws.getRow(n),product=r.getCell(6).value;r.getCell(10).value=product==='AIR'?10:product.startsWith('FCL')?1000:100;r.getCell(12).value=20;r.getCell(13).value=25;r.getCell(17).value=30000;r.getCell(18).value=200;r.getCell(19).value=({FCL20:33,FCL40:67,FCL45:85})[product]||0;r.getCell(20).value='LOCAL TEST ONLY — freight and listed charges';r.getCell(21).value='Duty, tax, insurance and delivery';r.getCell(22).value='auto';if(product==='LCL_DDP'){r.getCell(24).value='Dubai city — subject to goods value approval';r.getCell(25).value='YES';}}
await mkdir('test-output',{recursive:true});await wb.xlsx.writeFile('test-output/UKR-browser-import.xlsx');console.log('Prepared local synthetic route workbook.');
