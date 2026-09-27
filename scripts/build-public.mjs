import {writeFile,mkdir} from 'node:fs/promises';
import {renderPage,pages} from '../site/public-v2/templates.mjs';
import {languages} from '../site/public-v2/form-messages.mjs';
for(const lang of Object.keys(languages)){
 const dir='site'+(lang==='en'?'':'/'+lang);await mkdir(dir,{recursive:true});
 for(const page of pages)await writeFile(dir+'/'+page+'.html',renderPage(page,lang),'utf8');
}
console.log('Built 8 pages in 7 languages.');
