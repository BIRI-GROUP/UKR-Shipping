# Block 1 — Live Website Audit (Initial)

Date: 2026-09-27

## Confirmed existing URLs

| URL | Current purpose | Decision |
|---|---|---|
| / | Main homepage | REBUILD IN PLACE |
| /request-a-quote/ | General freight quote form | REBUILD IN PLACE |
| /track-your-shipment/ | Shipment tracking | URGENT REBUILD IN PLACE |
| /transportation-services/ | Land/sea/air transportation overview | REBUILD / use as transport hub |
| /china-to-the-uae/ | China → UAE service | KEEP URL + REBUILD as flagship hub |
| /china-storage-and-fulfilment/ | China warehousing / fulfillment | KEEP URL + REBUILD |
| /sea-cargo-ddp-delivered-duty-paid/ | Sea DDP | KEEP URL + REBUILD |
| /air-cargo-door-to-door-service/ | Air door-to-door | KEEP URL + REBUILD |
| /about-us/ | Company / network | KEEP URL + REFINE |
| /uae-export-to-uk/ | UAE/UK route content | KEEP URL + REVIEW CONTENT |
| /how-do-i-import-from-turkey-to-the-united-arab-emirates/ | Turkey/UAE route content | KEEP URL + REBUILD around current capability |

## Critical findings

1. The homepage already exposes Online Booking, Instant Quote, Sea Cargo, DDP/DDU, China→UAE LCL/FCL and Air Cargo. The new homepage should simplify this into one primary shipment search/quote action, then route customers to deeper products.
2. /request-a-quote/ already captures departure city, delivery city, weight, CBM, contact, shipper contact and commodity. Preserve the URL but replace the static form with the conditional booking/qualification engine.
3. /track-your-shipment/ currently contains unrelated “BestLogistics” wording. This is a high-priority trust defect and should be replaced by UKR-native tracking.
4. /transportation-services/ already describes China/UAE, UK/UAE, India/UAE, Europe/UAE and online booking/tracking concepts. Preserve it as a broad transport/services hub rather than creating a competing duplicate URL.
5. /china-to-the-uae/ already exists. Do NOT create a new /china-to-uae/ duplicate. Rebuild the existing URL as the flagship China→UAE hub.
6. /sea-cargo-ddp-delivered-duty-paid/ already exists. Preserve it for DDP sea intent and connect it to the new route/service catalog.
7. /air-cargo-door-to-door-service/ already exists. Preserve it and connect it to the Air/DDP booking flow.
8. The separate instant quote application at ad.ukrshipping.com/get-price-quote already supports China→UAE Sea/Air and shows shipping, boxes, clearance/customs, delivery and total. Treat it as existing business logic to audit/migrate, not as disposable content.

## URL rules

- Never create a duplicate topic URL when an established UKR URL already exists.
- Rebuild content and UX behind existing URLs first.
- Add new route/product pages only after checking the live site/index for an existing equivalent.
- If a page is consolidated later, use a deliberate redirect/migration plan rather than deleting it.

## Proposed simple main navigation

- Ship
- Sea
- Air
- Road
- Customs & DDP
- China → UAE
- Tools
- Track
- Login

Primary CTA: Get a Quote

## Homepage hierarchy

1. Simple origin → destination → cargo/service search
2. China→UAE flagship products
3. Sea / Air / Road / Customs & DDP
4. Smart Shipping / cost tools
5. How UKR works: pickup → ship → clear → deliver
6. Live tracking/customer portal
7. China warehouse and consolidation
8. UAE pickup/fleet
9. Proof/trust/network
10. Conversion CTA

## Next audit pass

- Enumerate additional indexed service and route URLs.
- Detect overlapping/duplicate intent.
- Map current pages to the canonical service matrix.
- Identify current internal links and likely migration dependencies.
- Produce final KEEP / REBUILD / MERGE / ADD matrix before public-site code changes.
