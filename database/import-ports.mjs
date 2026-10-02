import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const RELEASE='2025-1';
export const SOURCE='https://opensource.unicc.org/un/unece/uncefact/vocab-locode/-/jobs/artifacts/2025-1/download?job=package-release';
const PRIORITY=['CN','AE','SA','OM','QA','KW','TR','SY','GB','CA','JO','IQ','BH'];
// Editorial display priorities for UKR trade lanes, not a throughput ranking.
const MAJOR={CN:['CNSHA','CNNGB','CNYTN','CNSZX','CNNSA','CNTAO','CNTSN','CNXMN','CNDLC','CNSHK'],AE:['AEJEA','AEKHL','AEKLF','AESHJ','AEAUH','AEDXB'],SA:['SAJED','SADMM','SAKAC'],OM:['OMSLL','OMSOH','OMDQM'],QA:['QAHMD','QADOH'],KW:['KWSWK','KWSAA'],TR:['TRAMR','TRMER','TRIZM','TRIZT'],SY:['SYLTK','SYTTS'],GB:['GBFXT','GBLGP','GBSOU','GBLIV','GBTEE'],CA:['CAVAN','CAMTR','CAPRR','CAHAL'],JO:['JOAQB'],IQ:['IQUQR'],BH:['BAKBS'],SG:['SGSIN'],NL:['NLRTM'],BE:['BEANR'],DE:['DEHAM','DEBRV'],US:['USLAX','USLGB','USNYC','USSAV'],IN:['INNSA','INMUN'],KR:['KRPUS']};
const ALIASES={AEJEA:['Dubai','Jabal Ali','Jabel Ali','Jebel Ali Port'],CNNGB:['Ningbo','Ningbo Zhoushan'],CNNSA:['Nansha','Guangzhou Nansha'],CNYTN:['Yantian','Shenzhen Yantian'],CNSHA:['Shanghai','Shangai'],CNSHK:['Shekou','Shenzhen Shekou'],INNSA:['Nhava Sheva','Jawaharlal Nehru','JNPT'],TRAMR:['Ambarli','Istanbul Ambarli'],QAHMD:['Hamad Port'],AEKHL:['Khalifa Port'],GBLGP:['London Gateway']};
const DISPLAY={AEJEA:'Jebel Ali',CNNGB:'Ningbo',CNNSA:'Nansha',CNYTN:'Yantian',CNSHA:'Shanghai',AEKHL:'Khalifa Port'};
const COUNTRY_ALIASES={AE:['UAE','United Arab Emirates','Dubai'],CN:['China','PRC','中国','Zhongguo'],GB:['UK','Britain','United Kingdom','Great Britain'],US:['USA','US','United States','America'],TR:['Turkey','Türkiye','Turkiye'],SA:['KSA','Saudi Arabia'],KR:['South Korea','Korea'],SY:['Syria'],QA:['Qatar'],KW:['Kuwait'],OM:['Oman']};
export function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function convertRows(rows){
 const ports=new Map(),countries=new Map();let seen=0,removed=0;
 const names=new Intl.DisplayNames(['en'],{type:'region'});
 for(const row of rows){const [change,cc,location,name,ascii,subdivision,functions,status,date,iata,coordinates]=row.map(v=>v.trim());if(!/^[A-Z]{2}$/.test(cc||''))continue;
 const country=cc==='AE'?'United Arab Emirates':cc==='TR'?'Turkey':cc==='SY'?'Syria':names.of(cc)||cc;
 countries.set(cc,{code:cc,name:country,aliases:COUNTRY_ALIASES[cc]||[],priority:PRIORITY.includes(cc)?PRIORITY.indexOf(cc):999});
 if(!/^[A-Z2-9]{3}$/.test(location||''))continue;seen++;
 if(change==='X'||status==='XX'){removed++;continue;}if(!String(functions).startsWith('1'))continue;
 const code=cc+location;if(!name||name.startsWith('='))continue;
 if(ports.has(code)){const p=ports.get(code);if(name!==p.name&&!p.aliases.includes(name))p.aliases.push(name);continue;}
 const majors=MAJOR[cc]||[];ports.set(code,{code,name:DISPLAY[code]||name,nameAscii:ascii||name,country,countryCode:cc,subdivision,functions,status,coordinates:coordinates||null,aliases:[...new Set([...(ALIASES[code]||[]),name].filter(n=>n!==(DISPLAY[code]||name)))],priority:majors.includes(code)?majors.indexOf(code):999});
 }
 const list=[...ports.values()].sort((a,b)=>a.code.localeCompare(b.code));
 return {ports:list,countries:[...countries.values()].sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name)),sourceRows:seen,excludedDeletedRows:removed};
}
export async function importPorts({out='preview-dist',archive=process.env.UKR_LOCODE_ARCHIVE}={}){
 const dir='database/reference';await mkdir(dir,{recursive:true});
 const zip=archive||`${dir}/unlocode-${RELEASE}.zip`;let bytes;
 try{bytes=await readFile(zip);}catch{const res=await fetch(SOURCE,{signal:AbortSignal.timeout(120000)});if(!res.ok)throw Error(`Official port download: HTTP ${res.status}`);bytes=Buffer.from(await res.arrayBuffer());if(bytes.length<100000||bytes.length>80000000)throw Error('Unexpected port archive size');await writeFile(zip,bytes);}
 const members=execFileSync('unzip',['-Z1',zip],{encoding:'utf8',maxBuffer:5000000}).split('\n');
 const csvs=members.filter(n=>/CodeListPart[123]\.csv$/i.test(n));if(csvs.length!==3)throw Error(`Expected three official CSV parts. Found ${csvs.length}: ${members.slice(0,15).join(', ')}`);
 let rows=[];for(const member of csvs){const data=execFileSync('unzip',['-p',zip,member],{maxBuffer:50000000});let text=new TextDecoder('utf-8',{fatal:false}).decode(data);if(text.includes('\ufffd'))text=new TextDecoder('windows-1252').decode(data);rows.push(...parseCSV(text.replace(/^\uFEFF/,'')));}
 const data=convertRows(rows);if(data.sourceRows<90000||data.ports.length<5000||data.countries.length<200)throw Error(`Incomplete official directory: ${data.sourceRows} rows / ${data.ports.length} ports / ${data.countries.length} countries`);
 for(const code of ['AEJEA','CNNGB','CNSHA','CNNSA'])if(!data.ports.some(p=>p.code===code))throw Error(`Required maritime location missing: ${code}`);
 const metadata={release:RELEASE,source:SOURCE,sourcePage:'https://unlocode.unece.org/publications/',license:'CC BY 4.0',attribution:'United Nations Economic Commission for Europe (UNECE), UN/LOCODE 2025-1. Filtered and normalised by UKR.',archiveSha256:createHash('sha256').update(bytes).digest('hex'),importedAt:new Date().toISOString(),portCount:data.ports.length,countryCount:data.countries.length,sourceRows:data.sourceRows,excludedDeletedRows:data.excludedDeletedRows,filter:'Maritime function 1; deleted entries excluded; identical codes deduplicated with names retained as aliases.',priorityNote:'Major-port ordering is a UKR editorial priority, not an official cargo-volume ranking.',availabilityNote:'A directory entry does not establish container service, rates, sailing availability or UKR acceptance.'};
 const snapshot={metadata,countries:data.countries,ports:data.ports};const json=JSON.stringify(snapshot);
 await writeFile(`${dir}/ports-${RELEASE}.json`,json);await mkdir(`${out}/data`,{recursive:true});await copyFile(`${dir}/ports-${RELEASE}.json`,`${out}/data/ports.json`);
 await writeFile(`${out}/data/ports.js`,'window.UKR_PORT_DIRECTORY='+json.replace(/</g,'\\u003c')+';');
 await writeFile(`${out}/data/ports-metadata.json`,JSON.stringify(metadata,null,2));
 console.log('UKR_PORT_DIRECTORY '+JSON.stringify(metadata));console.log('UKR_PRIORITY_PORTS '+JSON.stringify(data.ports.filter(p=>['AEJEA','CNNGB','CNNSA','CNSHA'].includes(p.code))));return snapshot;
}
