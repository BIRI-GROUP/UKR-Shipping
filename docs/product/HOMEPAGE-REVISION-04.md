# UKR homepage revision 04

## Scope delivered
- Heading: Book & Ship. Made Simple. Supporting line: Direct Rates. Direct Booking.
- Shorter desktop hero and tighter header spacing. Mobile artwork fills the width without the former empty side strip.
- A masked overlay removes only the marked tall tower; existing aircraft, ship, truck and other skyline elements are retained. The base image remains unchanged outside the overlay.
- Legal company name: UKR SEA Shipping CO LLC. The logo descriptor and legal footer use SEA SHIPPING CO LLC, not Shipping & Logistics.
- Separate Knowledge Centre at /knowledge.html: topic filters, search, individual articles, representative container measurements with carrier sources, CBM explanations and a multi-package calculator. Calculator results can populate a Sea LCL search.
- Carrier comparisons remain explicitly coming soon. No unsourced rankings or performance claims have been published.

## Shared port reference data
`database/import-ports.mjs` imports the official UNECE UN/LOCODE 2025-1 release. The successful Render build of 2 October 2026 imported 116,229 source location rows and generated 17,520 unique maritime location records. The source contains 249 country/territory records; not every country has a maritime location.

Publication: https://unlocode.unece.org/publications/
Source format: https://unlocode.unece.org/docs/data-attributes/
Pinned archive SHA256: ad409fc7149b10f98d61190c34d9daf78b78bb8b31464cc66de1a89d09b01b5d
Attribution: United Nations Economic Commission for Europe. CC BY 4.0. UKR filters and normalises the data.

The import retains maritime-function entries, excludes deleted entries, deduplicates identical codes, and keeps alternate names. It writes a reusable build snapshot to database/reference/ports-2025-1.json and publishes /data/ports.json, /data/ports.js and /data/ports-metadata.json. The generated snapshot is a deployment artifact, not a committed 17,520-row database dump. The importer, source release, hash and display rules are committed in this branch. Searches use the locally served snapshot, not repeated third-party API requests.

Default FCL/LCL destination: Jebel Ali (AEJEA). The destination dropdown puts Jebel Ali and the UAE group first. Origin suggestions prioritise China and UKR's named trade-lane countries. Country browsing, familiar country aliases, common spelling variations and paginated results are supported. Major-port ordering is an editorial UKR priority, not a verified throughput ranking. A directory record does not guarantee a container service, operational availability, rate or acceptance.

## Rate integration contract for the next approved step
This revision prepares stable location identifiers in the search payload; it does NOT enable a new staff rate editor or a carrier-rate API.

A future rate row must identify: originPortId, destinationPortId, equipment (20GP, 40GP, 40HC or 45HC), carrier/provider, source (manual/import/API), currency, selling amount, validity, included/excluded charges, space/approval conditions and publication state. Supplier costs and credentials must remain server-side. Do not expose them in public reference files.

Examples requested by Bayan:
- Ningbo to Jebel Ali: separate 20GP, 40GP and 40HC values; 45HC only when offered.
- Nansha to Jebel Ali: its own values for the same equipment choices.
- Additional/minor origin and destination ports: explicitly configured routes, not automatic copies of a major-port rate.

Prices may be equal, but 40GP and 40HC must remain distinct equipment records. Unavailable equipment is not a zero-price offer. No example prices have been invented.

Official maritime identifiers can differ from carrier city codes. This release contains Ningbo (CNNBO) and Ningbo Pt (CNNBG), with CNNGB searchable as a familiar alias; Shanghai is similarly represented by explicit official locations. Search aliases are NOT approved provider mappings. Carrier integration must use an explicit, reviewed mapping, and staff must select the intended location/terminal rather than match a fuzzy name automatically.

An official candidate for later account-authorised integration is CMA CGM's Quotations and Public Tariff API: https://api-portal.cma-cgm.com/products/pricingApi . Its documented coverage, authentication and exclusions need review against UKR's accounts. This is not a promise of free worldwide spot rates. Manual records should remain usable alongside approved API imports.

## Verification and boundaries
- Build gating in preview/finalize4.mjs compiles the published JavaScript and tests real imported data: country filters, spelling tolerance, code lookup, priorities, uniqueness, maritime functions, page presence and legal identity. Results are published at /build-checks.json.
- Thirteen in-memory Chromium interaction checks passed using an explicit synthetic port fixture and an essential-layout harness. They covered service switching, canonical IDs, FCL search, email/review/terms gating, Knowledge Centre filters, CBM totals and calculator handoff. Knowledge pages had no page-level overflow at 375, 390, 768, 1024 and 1440px.
- Browser network navigation is blocked in this environment. The local harness is not an end-to-end browser verification of the live deployment.
- Only the separate ukr-booking-lab Render service is deployed. No merge to main and no changes to live customer/staff applications or backend.
- No live rates, bookings, payments, uploads, tracking lookups or official quotation PDFs have been activated.
