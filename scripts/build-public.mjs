import {writeFile,mkdir} from 'node:fs/promises';
import {renderPage,pages} from '../site/public-v2/templates.mjs';
import {languages,addLanguageShell,copyLanguageAssets} from '../site/i18n/build.mjs';
await copyLanguageAssets('site');
for(const language of languages){
 const lang=language.id,dir='site'+(lang==='en'?'':'/'+lang);await mkdir(dir,{recursive:true});
 for(const page of pages)await writeFile(dir+'/'+page+'.html',addLanguageShell(renderPage(page,lang)), 'utf8');
}
console.log(`Built ${pages.length} pages in ${languages.length} languages: ${languages.map(l=>l.id).join(', ')}.`);
