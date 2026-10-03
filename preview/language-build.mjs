import {readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {addLanguageShell,copyLanguageAssets,languages} from '../site/i18n/build.mjs';
import {addDraftCopy} from './language-copy.mjs';
export async function buildPreviewLanguages(out='preview-dist',{publicMessages}={}) {
  // Reuse the project's existing seven-language dictionaries rather than duplicate them.
  if(!publicMessages)({messages:publicMessages}=await import('../site/public-v2/form-messages.mjs'));
  const catalog=Object.fromEntries(languages.map(l=>[l.id,{}])),sourceKeys=Object.create(null);
  for(const [key,source]of Object.entries(publicMessages.en||{})){
    if(typeof source!=='string'||!source.trim())continue;
    const id='public.'+key;
    for(const lang of languages)if(typeof publicMessages[lang.id]?.[key]==='string')catalog[lang.id][id]=publicMessages[lang.id][key];
    sourceKeys[source.replace(/\s+/g,' ').trim()]=id;
  }
  addDraftCopy(catalog,sourceKeys);
  await copyLanguageAssets(out);
  await copyFile(new URL('language-ui.js',import.meta.url),`${out}/i18n/preview-ui.js`);
  const slash=String.fromCharCode(92);
  const safeJSON=value=>JSON.stringify(value).replaceAll('<',slash+'u003c').replaceAll(String.fromCharCode(8232),slash+'u2028').replaceAll(String.fromCharCode(8233),slash+'u2029');
  await writeFile(`${out}/i18n/page-messages.js`,`window.UKRPageMessages=${safeJSON(catalog)};\nwindow.UKRPageSourceKeys=${safeJSON(sourceKeys)};\n`);
  const pages=[];
  async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${entry.name}`;if(entry.isDirectory()){if(!['assets','data','i18n'].includes(entry.name))await visit(path);}else if(entry.name.endsWith('.html')){const html=addLanguageShell(await readFile(path,'utf8'),{mode:'inline',preview:true});await writeFile(path,html);pages.push(path.slice(out.length+1));}}}
  await visit(out);
  try {
    const version=JSON.parse(await readFile(`${out}/version.json`,'utf8'));
    version.htmlSha256=createHash('sha256').update(await readFile(`${out}/index.html`)).digest('hex');
    version.languageFoundation=1;version.languageOrder=languages.map(l=>l.id);
    await writeFile(`${out}/version.json`,JSON.stringify(version));
  } catch(error) { if(error.code!=='ENOENT')throw error; }
  const report={version:1,order:languages.map(l=>l.id),rtl:languages.filter(l=>l.dir==='rtl').map(l=>l.id),pages,mode:'in-place preview; no real booking APIs',translationStatus:'partial draft copy; untranslated content explicitly disclosed',catalogSha256:createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),missingKeys:Object.fromEntries(languages.map(l=>[l.id,Object.keys(catalog.en).filter(key=>!catalog[l.id][key])]))};
  await writeFile(`${out}/language-checks.json`,JSON.stringify(report,null,2));
  console.log('UKR language foundation: '+pages.length+' preview pages; '+report.order.join(', '));
  return report;
}
