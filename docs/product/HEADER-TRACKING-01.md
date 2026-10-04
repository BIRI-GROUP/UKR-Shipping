# UKR Booking Lab: header and tracking release 01

## Target
Only https://ukr-booking-lab.onrender.com, Render service srv-db006v3tqb8s73e1caqg, repository BIRI-GROUP/UKR-Shipping, branch draft/booking-homepage-2026-10-02. The older website and staff staging service are not modified or redeployed.

## Implemented
- One shared branded header on the 17 current pages. The existing logo stays at the left, with country/language controls and navigation in the same header. A blue Customer Portal button links to the existing /portal.html entry point. Mobile uses an expandable menu.
- Large central Track your shipment form within the homepage hero, above the existing seven-service booking module. No DHL-style three-card row is introduced.
- Existing logo and photograph assets are reused unchanged. The build verifies that the service-booking section and hero image markup are unchanged by this header transformation.
- The country selector uses the existing country/territory reference list, localized through the existing language runtime. IP estimates and manual choices are distinguished. Users can override or retry IP detection. Country selection never changes the language, shipment route, tariff, service availability or company-access rights.
- 36 header/tracking copy rows are supplied in all seven languages, in order EN, AR, RU, FR, UR, HI, ZH. New copy is merged into the existing complete translation catalog. Arabic and Urdu remain RTL; the brand image is not mirrored.

## Country lookup and privacy
The browser makes a fixed GET to https://api.country.is/ only when no valid saved manual country or recent country estimate exists, or when the visitor explicitly requests detection. The endpoint returns the caller's country. The implementation reads the country code only; it does not save the returned IP address. No customer input, tracking reference, booking details, cookies or referrer are sent by this request. There is no precise-location/GPS request.

The request has a 4.5-second timeout and an exact response-country allowlist. Failures leave the selector available without inventing a country. Manual choices win over an in-flight automatic lookup. Local storage holds the manual country code; the six-hour session cache holds only a country code and timestamp. Storage failures are handled. The country dialog discloses Country.is as the provider and notes that VPNs may affect the estimate.

The browser connection policy permits only https://api.country.is, rather than opening general backend access. Form submission by native navigation remains blocked. Other booking/payment APIs are not activated.

Provider documentation checked: https://country.is/ and https://github.com/lineofflight/country . Endpoint availability and IP geolocation accuracy are external dependencies, not guaranteed by this release.

## Tracking boundary
The new tracking entrance validates a reference and opens the existing tracking-help dialog with the entered reference preserved. It does not claim to have retrieved a shipment status. An explicit email link lets the visitor compose a tracking-update request to UKR; no email is sent automatically. There are no invented tracking events, fake shipment records, or live-tracking claims. Real tracking, customer authentication and operational dashboards remain separate backend integration work.

## Validation
- 19 local Node tests passed, covering language columns, country priority/cache handling, blocked storage, request minimization, timeout/failure cases, tracking validation, preservation of the service box/photo/headline, shared subpage header and JavaScript parsing.
- 241 in-memory Chromium assertions passed with zero JavaScript page errors. Checks covered country selection, failure fallback, tracking validation/help/email composition, all seven language switches, preservation of shipment fields, mobile menu/portal access and new-header/tracking overflow at 375, 390, 768, 1024 and 1440 pixels.
- Browser network navigation, including localhost, is blocked by environment policy. The browser harness used representative baseline CSS, a placeholder image, the original service script, language integration, synthetic country responses and storage test doubles. It is not a live-browser visit, actual-provider/CORS availability test, complete visual certification of the hosted page, or native browser storage certification.
- The five implementation source files saved to GitHub matched the locally tested Git blob hashes. The production build also runs two generated-output header tests, the existing translation tests and the original port/artwork checks before publishing.

Publication is reported only after Render confirms a live deployment. The deployment logs and /header-checks.json identify the resulting pages, country count, language order and preserved service-section hash. /version.json identifies the deployed commit.
