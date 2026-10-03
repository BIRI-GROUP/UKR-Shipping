# UKR booking-first homepage: draft 01

Date: 2026-10-02
Repository: BIRI-GROUP/UKR-Shipping
Branch: draft/booking-homepage-2026-10-02
Base commit: 3879f2e84bdca9f708f403a03669b3807903faf4
Preview entry: site/booking-draft.html

## Scope and safety

This is an isolated, interactive homepage proposal inside the existing UKR repository. It does not replace site/index.html, change shared styles, modify the customer or staff applications, call the booking API, send emails, upload documents, take payment, or create booking records. It is not a deployed homepage. A future preview deployment would expose /booking-draft.html.

The file is standalone HTML, CSS and JavaScript, with no package dependencies. Open it in a browser to try the interactions. Hosted inside the existing site, it uses /assets/ukr-shipping-blue.svg and existing relative page links. Offline, a text-and-icon fallback wordmark is displayed. Brand tokens come from site/public-v2/site.css. The fallback is not an approved replacement logo.

## Implemented for design review

- Book. Ship. Easy like never before. / Direct Rates. Direct Booking.
- Seven service cards: Sea FCL, Sea LCL, Sea DDP, Air DDP, Air Express, Land Transport, Customs Clearance.
- Cards collapse into service tabs. Per-service entries survive switching.
- FCL container choices: 20 FT, 40 FT, 40 HC, 45 FT.
- Searchable preview ports grouped by priority countries.
- DDP origin fixed to China; destinations UAE, Saudi Arabia, Oman, Qatar and Kuwait.
- Land directions: UAE to other GCC countries and back, Turkey to UAE, UAE to Syria/Jordan/Iraq.
- Customs countries: UAE, Oman, Syria, Turkey, United Kingdom and Canada.
- Hash-routed results view with two explicitly labelled layout examples.
- Booking slide-over: customer/company, phone/email, repeated-email validation, goods/quantity, optional VAT/address and dimensions/document names, review and a preview acknowledgement gate.
- Preview submission receipt. No real booking or email verification is performed.
- Tracking, estimate PDF, official quotation and careers are explicitly pending.
- Existing services, routes, tools, news, contact and portal links retained.

## Deliberate limits

Prices, departures, arrivals, carrier identity and space availability are not invented. They remain pending until approved rate and schedule records are connected. Preview options are not available shipments.

The port directory is a small curated interface fixture, not a complete world-port database, verified operational directory or audited port-throughput ranking. Validate names/codes and add the full licensed/approved directory before launch.

No sea DDP tier calculation has been implemented. The requested labels (1-3, 4-10, 10-20 and 20+ CBM) have overlapping endpoints and leave fractional-volume interpretation unclear. Obtain approval for exact boundaries, treatment of decimals, minimums, weight limits, inclusions and currency. Air DDP and express require their own chargeable-weight rules.

File inputs display file names only. Documents are not read or uploaded. The preview checks up to five files and 10 MB per file, but real uploads require server-side validation, malware checks, private storage and authorization. Booking details remain in memory and are cleared when the drawer closes. Use test details, not real shipment documents, during review.

The contact phone and email were carried from project reference material; confirm the intended public contact details before launch.

## Validation performed

Chromium automation checked the initial layout, all seven services, requested equipment choices, fixed China origin, preservation of search entries, pending-rate results, email matching, VAT fields, review/acknowledgement gating, preview-only completion, land directions, customs countries, keyboard tabs, tracking placeholder and Escape close. No JavaScript runtime errors were observed. No horizontal overflow was observed at widths 375, 390, 768, 1024 and 1440 pixels.

Screenshots and the local test script accompany the review package. These are local Chromium checks, not cross-browser certification or production end-to-end tests.

## Before promotion

1. Approve homepage layout and final logo rendering. Integrate through the site's source templates/build process rather than relying only on replacing generated HTML.
2. Map each service to existing public API contracts. Query approved rates and schedules; calculate selling prices server-side without exposing supplier cost or margin.
3. Add real booking submission with validation, idempotency and explicit pending-approval status. VAT registration alone must not grant trusted-account or instant-confirmation privileges.
4. Integrate customer/staff records, permission checks, private document storage and verified email workflows.
5. Generate estimates and official quotations, with 48-hour validity bounded by underlying tariff availability and final UKR approval. Save quotations and documents to authorized records.
6. Publish cancellation terms and payment flags per approved offer. Keep payment on arrival, online payment and installments hidden unless genuinely supported. Space alternatives require customer approval.
7. Confirm complete port data, tariff boundary rules, contact details, operational coverage and SEO URL mapping.

Main, existing dashboards and live services are unchanged by this draft.
