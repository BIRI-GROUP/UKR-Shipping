import {readFile,mkdir,copyFile} from 'node:fs/promises';
import vm from 'node:vm';
const sourceRoot = new URL('./',import.meta.url);
const context={};vm.runInNewContext(await readFile(new URL('languages.js',sourceRoot),'utf8'),context);
export const languages = context.UKRLocales.languages;
export async function copyLanguageAssets(out) {
  await mkdir(`${out}/i18n`,{recursive:true});
  for(const file of ['languages.js','picker.js','picker.css']){
    const source=new URL(file,sourceRoot);
    // Source and destination can coincide when generating the committed public site.
    const {resolve}=await import('node:path');const {fileURLToPath}=await import('node:url');
    if(resolve(`${out}/i18n/${file}`)!==fileURLToPath(source))await copyFile(source,`${out}/i18n/${file}`);
  }
}
export function addLanguageShell(html,{mode='paths',preview=false}={}) {
  if(!['inline','paths'].includes(mode))throw new TypeError('Invalid locale rendering mode');
  if(!html.includes('</head>'))throw new Error('Page has no head');
  if(html.includes('data-ukr-language-mode='))return html;
  const head=`<link rel="stylesheet" href="/i18n/picker.css?v=1"><script src="/i18n/languages.js?v=1"></script>${preview?'<script src="/i18n/page-messages.js?v=1"></script><script defer src="/i18n/preview-ui.js?v=1"></script>':''}<script defer src="/i18n/picker.js?v=1"></script>`;
  return html.replace('<html ',`<html data-ukr-language-mode="${mode}" `).replace('</head>',head+'</head>');
}
