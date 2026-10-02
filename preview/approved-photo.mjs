import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Use the photograph supplied by the user. Web optimization only:
// no crop, regenerated content, tower patches or other overlays.
const sha256 = 'd4f557252b389c3fead1b76e9519fdae94d1d5be09e691e5963311d5e1a0e2c4';
const originalSha256 = 'b198e40d6040f82c2071d250dc3138bac894df9636708fe7635e1d8aa8ef2bd2';
const filename = 'hero-approved-d4f55725.webp';
const parts = await Promise.all([1, 2, 3, 4, 5, 6].map(n =>
  readFile(new URL(`./assets/hero-upload-${n}.b64`, import.meta.url), 'utf8')));
const encoded = parts.join('').replace(/\s/g, '');
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid hero encoding.');
const data = Buffer.from(encoded, 'base64');
if (data.length !== 43978 || data.toString('ascii', 0, 4) !== 'RIFF' ||
    data.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Invalid hero image format.');
if (createHash('sha256').update(data).digest('hex') !== sha256)
  throw new Error('Approved hero checksum mismatch. Refusing to publish.');

const path = 'preview-dist/index.html';
const before = await readFile(path, 'utf8');
const oldSource = 'class="hero-photo" src="/assets/hero.svg"';
const newSource = 'class="hero-photo" src="/assets/' + filename + '"';
if (before.split(oldSource).length !== 2) throw new Error('Expected exactly one existing hero.');
const after = before.replace(oldSource, newSource);
if (after.replace(newSource, oldSource) !== before)
  throw new Error('Unexpected non-image HTML change.');
await writeFile('preview-dist/assets/' + filename, data);
await writeFile(path, after);

const versionPath = 'preview-dist/version.json';
const version = JSON.parse(await readFile(versionPath, 'utf8'));
version.artworkEdit = 'User-uploaded photograph, web-optimized; no crop, overlays or regeneration.';
version.heroImage = {
  path: '/assets/' + filename, sha256, originalSha256,
  width: 800, height: 636, originalBytes: false, imageOnlyChange: true
};
await writeFile(versionPath, JSON.stringify(version));
console.log('UKR_APPROVED_HERO ' + JSON.stringify({
  sha256, bytes: data.length, source: 'user-upload',
  noExternalDownload: true, imageOnlyChange: true
}));
