# Homepage draft revision 02

## Requested change
Remove the decorative China-to-GCC / YOUR NEXT SHIPMENT card from the hero. Leave any future search-related visual for a later iteration.

## Implemented
- Removed the hero card markup and its unused decorative styles.
- Centred the desktop headline and reduced desktop hero spacing so the seven-service booking module is more prominent. Mobile remains left-aligned.
- Kept all seven services, China DDP origins and destinations, search forms, results, booking drawer, existing links and logo loading unchanged.
- Updated the visible draft label to revision 02.

File: `site/booking-draft.html`
Commit: `806c00013b5d8b2ff56996a2f1b04944f5c6c0f0`
Verified content blob: `6afe86e00c6259e1f3c5a175b1fa5421d35d10e5`, identical to the locally tested HTML.

## Regression checks
Passed local Chromium checks for seven service cards; FCL ports and equipment; fixed-China DDP; saved form values on service switching; results with pending rates; booking review; email match; optional VAT; terms gating; land directions; six customs countries; keyboard tabs; tracking placeholder and Escape dismissal.
No JavaScript runtime errors or horizontal overflow at widths 375, 390, 768, 1024 and 1440 pixels.

## Boundaries
This is still a draft on `draft/booking-homepage-2026-10-02`, not a production rollout. No merge or deployment was performed as part of this revision. Customer/staff dashboards, backend, actual logo assets and live rates were not changed. No real booking, upload, payment, email, tracking retrieval or quotation PDF is enabled.

Sea/air/road logo exploration is a separate design proposal, not an approved or installed replacement.
