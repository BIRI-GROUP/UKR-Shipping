import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Isolated static preview. Never publishes /site, customer data, API code or secrets.
const out = 'preview-dist';
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/assets`, { recursive: true });
let html = await readFile('site/booking-draft.html', 'utf8');
if (!html.includes('id="serviceTabs"') || !html.includes('id="bookingDrawer"')) {
  throw new Error('Unexpected prototype structure. Review build before publishing.');
}
const svg = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const hero = `<section class="hero"><img class="hero-photo" src="/assets/hero.svg" alt="" fetchpriority="high"><div class="wrap hero-layout"><div class="hero-copy"><p class="eyebrow">GLOBAL SHIPPING SOLUTIONS</p><h1>Book. Ship.<span>Easy Like Nothing Before.</span></h1><p class="tagline">Direct Rates. Direct Booking.</p><div class="hero-promises"><span>${svg('shield')}Sea, air &amp; road</span><span>${svg('clock')}One simple booking journey</span><span>${svg('check')}Your UKR team</span></div></div></div></section>`;
html = html.replace(/<section class="hero">[\s\S]*?<\/section>/, hero);
html = html.replace('</head>', '<link rel="stylesheet" href="/theme.css?v=3"><meta name="referrer" content="no-referrer"></head>');
html = html.replace('HOMEPAGE DRAFT', 'TEST PREVIEW · NO LIVE BOOKINGS');
html = html.replace('UAE BASED. GLOBALLY CONNECTED.', 'UKR SHIPPING · DESIGN LAB');
html = html.replace(/<h2 id="bookingTitle">.*?<\/h2>/, '<h2 id="bookingTitle">Choose your service</h2>');
html = html.replace('Seven services. One simple place to start.', 'Select a service to start your search.');
html = html.replace('<span class="wordmark" id="brandFallback">', '<span class="wordmark" id="brandFallback" hidden>');
html = html.replace('<img id="brandLogo" alt="UKR Shipping" width="211" height="70" hidden>', '<img id="brandLogo" src="/assets/logo.svg" alt="UKR Shipping &amp; Logistics" width="224" height="92">');
html = html.replace("$('brandLogo').src='/assets/ukr-shipping-blue.svg';", "$('brandLogo').src='/assets/logo.svg';");
html = html.replace(/href="https:\/\/ukr-staff-staging.onrender.com\/"/g, 'href="/staff.html"');
html = html.replace(/href="https:\/\/ukr-shipping-preview.onrender.com([^\"]*)"/g, 'href="$1"');
html = html.replace('Design draft 02', 'Design preview 03').replace('Design draft 01', 'Design preview 03');
html = html.replace('Track shipment</button>', '<span class="track-label">Track shipment</span></button>');
const benefits = `<div class="trust-row benefits"><span class="inline-item">${svg('search')}<span><b>Compare your options</b><small>See rates, routes and schedules</small></span></span><span class="inline-item">${svg('check')}<span><b>Simple online booking</b><small>Review before you submit</small></span></span><span class="inline-item">${svg('phone')}<span><b>Real people. Real support.</b><small>The UKR team is here to help</small></span></span><span class="inline-item">${svg('truck')}<span><b>From start to finish</b><small>Sea, air, road and customs</small></span></span></div>`;
html = html.replace(/<div class="trust-row">[\s\S]*?<\/div>/, benefits);
const partner = `<section class="partner" aria-labelledby="partner-title"><div class="partner-copy"><p class="eyebrow">ONE CONNECTED SHIPPING PLATFORM</p><h2 id="partner-title">More Than Shipping.<br>A Complete Logistics Partner.</h2><p>Sea freight, air cargo, land transport and customs clearance. Choose the service your business needs, with UKR at every step.</p><a class="button" href="/services.html">Explore our services ${svg('arrow')}</a></div><div class="network-card"><div>${svg('ship')}<span><small>Ocean freight</small><b>FCL, LCL &amp; China DDP</b></span></div><div>${svg('plane')}<span><small>Air cargo</small><b>DDP &amp; express options</b></span></div><div>${svg('truck')}<span><small>Land transport</small><b>UAE, GCC &amp; regional routes</b></span></div><div>${svg('customs')}<span><small>Customs clearance</small><b>UAE · Oman · Syria · Turkey · UK · Canada</b></span></div></div></section>`;
html = html.replace('<section class="overview"', partner + '<section class="overview"');
const footer = `<footer class="footer"><div class="wrap"><div class="footer-columns"><div><a href="#home" class="footer-brand"><img src="/assets/logo.svg" width="224" height="92" alt="UKR Shipping &amp; Logistics"></a><p>Sea. Air. Road. Customs.<br>One place to start your shipment.</p></div><div><h3>Our services</h3><a href="#home" data-mode="fcl">Sea freight</a><a href="#home" data-mode="air-ddp">Air cargo</a><a href="#home" data-mode="land">Land transport</a><a href="#home" data-mode="customs">Customs clearance</a></div><div><h3>Information &amp; tools</h3><a href="/tools.html">Shipping tools</a><a href="/routes.html">Routes &amp; destinations</a><a href="/news.html">News</a><a href="/careers.html">Join our team</a></div><div><h3>Get in touch</h3><a href="tel:+97143888014">${svg('phone')}+971 4 388 8014</a><a href="mailto:freight.dxb@ukrshipping.com">${svg('mail')}freight.dxb@ukrshipping.com</a><a href="/contact.html">${svg('track')}Dubai, United Arab Emirates</a><a href="/portal.html">Customer login</a></div></div><div class="footer-bottom"><span>© 2026 UKR SEA SHIPPING CO LLC - Dubai</span><span class="preview-note">Test preview · No live bookings or payments</span></div></div></footer>`;
html = html.replace(/<footer class="footer">[\s\S]*?<\/footer>/, footer);
html = html.replace('</body>', '<script src="/theme.js?v=3"></script></body>');
await writeFile(`${out}/index.html`, html);
for (const file of ['theme.css', 'theme.js']) await copyFile(`preview/${file}`, `${out}/${file}`);
for (const file of ['hero.svg', 'logo.svg']) await copyFile(`preview/${file}`, `${out}/assets/${file}`);
await writeFile(`${out}/robots.txt`, 'User-agent: *\nDisallow: /\n');
const pages = { services:'Our services', routes:'Routes & destinations', tools:'Information & tools', news:'News', contact:'Contact UKR', portal:'Customer dashboard', staff:'Staff dashboard', careers:'Join our team', privacy:'Privacy information', terms:'Booking terms' };
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for (const [path, title] of Object.entries(pages)) {
  await writeFile(`${out}/${path}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)} | UKR preview</title><link rel="stylesheet" href="/theme.css?v=3"></head><body class="coming-page"><header><a href="/"><img src="/assets/logo.svg" width="224" height="92" alt="UKR Shipping &amp; Logistics"></a><span>TEST PREVIEW</span></header><main><p class="eyebrow">${esc(title)}</p><h1>We're getting this ready.</h1><p>This section of the new UKR platform is coming soon. The existing website and dashboards have not been changed.</p><a class="button" href="/">Back to booking preview</a><div class="coming-contact"><h2>Need a quote now?</h2><a href="tel:+97143888014">+971 4 388 8014</a><a href="mailto:freight.dxb@ukrshipping.com">freight.dxb@ukrshipping.com</a></div><small>Please use test details only. This preview does not save bookings or documents and does not take payments.</small></main></body></html>`);
}
await writeFile(`${out}/404.html`, await readFile(`${out}/services.html`, 'utf8'));
await writeFile(`${out}/version.json`, JSON.stringify({ preview: true, revision: 3, commit: process.env.RENDER_GIT_COMMIT || 'local-test', builtAt: new Date().toISOString(), htmlSha256:createHash('sha256').update(html).digest('hex'), bookingAPI:false }));
console.log('UKR isolated preview built. No production applications or APIs published.');
