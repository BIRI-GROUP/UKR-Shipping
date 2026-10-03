import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Artwork is derived from the homepage concept approved in this conversation.
const parts = await Promise.all([1, 2, 3].map(n => readFile(`preview/hero-${n}.b64`, 'utf8')));
const data = parts.join('').replace(/\s/g, '');
const digest = createHash('sha256').update(Buffer.from(data, 'base64')).digest('hex');
if (digest !== '33a0d2bb8abe19734e06f9b7cb9883217117770ddcb1aadc2b1ef367962b2253') {
  throw new Error('Hero artwork integrity check failed. Refusing to publish.');
}
await writeFile('preview/hero.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="467" height="372" viewBox="0 0 467 372"><image width="467" height="372" href="data:image/webp;base64,${data}"/></svg>`);
await import('./build.mjs');
await import('./revision4.mjs');
await import('./finalize4.mjs');
await import('./approved-photo.mjs');
// The same Booking Lab build now requires complete authored translations on every page.
const {completeTranslation} = await import('./translation-release.mjs');
await completeTranslation();
const {execFileSync} = await import('node:child_process');
execFileSync(process.execPath, ['--test', 'tests/translation-release.test.mjs'], {stdio:'inherit'});
const path = 'preview-dist/index.html';
let html = await readFile(path, 'utf8');
const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'">`;
html = html.replace('<head>', '<head>\n' + csp);
await writeFile(path, html);
const versionPath = 'preview-dist/version.json';
const version = JSON.parse(await readFile(versionPath, 'utf8'));
version.htmlSha256 = createHash('sha256').update(html).digest('hex');
version.artworkVerified = true;
version.connectPolicy = 'none';
await writeFile(versionPath, JSON.stringify(version));
console.log('Preview artwork verified; browser API connections and form submissions blocked.');
