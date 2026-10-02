import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Only the hero resource changes. Layout, forms, directory and knowledge pages stay untouched.
const sha256 = 'b198e40d6040f82c2071d250dc3138bac894df9636708fe7635e1d8aa8ef2bd2';
const filename = 'hero-approved-b198e40d.jpeg';
const source = new URL('./assets/' + filename, import.meta.url);
let data;
try {
  data = await readFile(source);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  // One-time import only; this URL is supplied privately to the preview build.
  // Once committed, the repository image is the sole source and no download is needed.
  const url = process.env.UKR_HERO_IMPORT_URL;
  if (!url) throw new Error('Approved hero asset is missing from the repository.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'd2jqrm6oza8nb6.cloudfront.net') {
    throw new Error('Unexpected hero import host.');
  }
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  } catch {
    throw new Error('Approved hero import failed; URL is deliberately not logged.');
  }
  if (!response.ok) throw new Error('Approved hero import returned HTTP ' + response.status);
  data = Buffer.from(await response.arrayBuffer());
}
const actual = createHash('sha256').update(data).digest('hex');
if (actual !== sha256) throw new Error('Approved hero checksum mismatch. Refusing to publish.');
await writeFile('preview-dist/assets/' + filename, data);
const path = 'preview-dist/index.html';
const before = await readFile(path, 'utf8');
const oldSource = 'class="hero-photo" src="/assets/hero.svg"';
const newSource = 'class="hero-photo" src="/assets/' + filename + '"';
if (before.split(oldSource).length !== 2) throw new Error('Expected exactly one existing hero image.');
const after = before.replace(oldSource, newSource);
if (after.replace(newSource, oldSource) !== before) throw new Error('Unexpected non-image HTML change.');
await writeFile(path, after);
const versionPath = 'preview-dist/version.json';
const version = JSON.parse(await readFile(versionPath, 'utf8'));
version.artworkEdit = 'Exact user-uploaded photograph; no overlays or regeneration.';
version.heroImage = { path: '/assets/' + filename, sha256, width: 1407, height: 1118, originalBytes: true };
await writeFile(versionPath, JSON.stringify(version));
console.log('UKR_APPROVED_HERO ' + JSON.stringify({ sha256, bytes: data.length, source: 'user-upload', imageOnlyChange: true }));
