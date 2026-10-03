import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
export const assetPath = '/header/tracking-compact.css?v=2';
export function compactMarkup(html) {
  if (!html.includes('id="heroTrackForm"') || !html.includes('class="tracking-feature wrap"')) {
    throw new Error('Compact tracking requires the existing homepage tracking form.');
  }
  if (!html.includes('</head>')) throw new Error('Homepage head not found.');
  const link = `<link rel="stylesheet" href="${assetPath}">`;
  if (html.includes(link)) return html;
  const next = html.replace('</head>', link + '</head>');
  // This change must not alter page copy, service tabs, imagery, form fields or scripts.
  if (next.replace(link, '') !== html) throw new Error('Unexpected non-style homepage change.');
  return next;
}
export async function releaseCompactTracking(out = 'preview-dist') {
  const path = join(out, 'index.html');
  const before = await readFile(path, 'utf8');
  const html = compactMarkup(before);
  await mkdir(join(out, 'header'), {recursive:true});
  await copyFile(new URL('./compact.css', import.meta.url), join(out, 'header/tracking-compact.css'));
  await writeFile(path, html);
  const versionPath = join(out, 'version.json');
  const version = JSON.parse(await readFile(versionPath, 'utf8'));
  Object.assign(version, {trackingLayoutRelease:2, htmlSha256:hash(html)});
  await writeFile(versionPath, JSON.stringify(version));
  const report = {
    release:2, scope:'Homepage tracking dimensions and text-column alignment only',
    maximumDesktopWidth:600, mobileFullWidth:true, languageOrder:['en','ar','ru','fr','ur','hi','zh'],
    bodyUnchanged:before.slice(before.indexOf('<body')) === html.slice(html.indexOf('<body')),
    trackingBackendConnected:false, emailOtpEnabled:false,
    cssSha256:hash(await readFile(join(out, 'header/tracking-compact.css')))
  };
  if (!report.bodyUnchanged) throw new Error('Homepage body changed unexpectedly.');
  await writeFile(join(out, 'tracking-layout-checks.json'), JSON.stringify(report, null, 2));
  console.log('UKR_COMPACT_TRACKING ' + JSON.stringify(report));
  return report;
}
