import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assetPath,compactMarkup,releaseCompactTracking} from '../preview/header/compact.mjs';
const sample='<!doctype html><html><head><title>UKR</title></head><body><section class="tracking-feature wrap"><form id="heroTrackForm"><input id="heroTrackingReference"><button>Track shipment</button></form></section><section id="services">Keep all services</section></body></html>';

test('only a versioned stylesheet is added; homepage body stays byte-identical',()=>{
  const next=compactMarkup(sample);
  assert.equal(next.replace(`<link rel="stylesheet" href="${assetPath}">`,''),sample);
});
test('applying the stylesheet twice is idempotent',()=>{
  const once=compactMarkup(sample);assert.equal(compactMarkup(once),once);
});
test('wrong page or missing head fails closed',()=>{
  assert.throws(()=>compactMarkup('<html><head></head><body></body></html>'));
  assert.throws(()=>compactMarkup(sample.replace('</head>','')));
});
test('compact styles cover desktop, tablet, mobile and RTL without hiding features',async()=>{
  const css=await readFile(new URL('../preview/header/compact.css',import.meta.url),'utf8');
  for(const expected of ['width:min(61%,600px)','margin-inline-start:0','@media(max-width:980px)','@media(max-width:600px)','html[dir=rtl]'])assert.ok(css.includes(expected));
  assert.doesNotMatch(css, /\.hero-photo|\.service-tab|\.booking-shell|\.ukr-header|url\(/);
});
test('isolated build writes CSS and accurate release metadata without enabling APIs',async()=>{
  const out=await mkdtemp(join(tmpdir(),'ukr-track-'));
  try{
    await writeFile(join(out,'index.html'),sample);
    await writeFile(join(out,'version.json'),JSON.stringify({liveBookings:false,headerRelease:1}));
    const r=await releaseCompactTracking(out);
    assert.equal(r.bodyUnchanged,true);assert.equal(r.emailOtpEnabled,false);assert.equal(r.trackingBackendConnected,false);
    assert.equal(await readFile(join(out,'header/tracking-compact.css'),'utf8'),await readFile(new URL('../preview/header/compact.css',import.meta.url),'utf8'));
    const v=JSON.parse(await readFile(join(out,'version.json'),'utf8'));
    assert.equal(v.liveBookings,false);assert.equal(v.headerRelease,1);assert.equal(v.trackingLayoutRelease,2);
  }finally{await rm(out,{recursive:true,force:true});}
});
