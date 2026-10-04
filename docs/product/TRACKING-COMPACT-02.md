# UKR Tracking: compact layout 02 and email-code request

## Implemented in this release
Target: https://ukr-booking-lab.onrender.com only, service srv-db006v3tqb8s73e1caqg.
Repository BIRI-GROUP/UKR-Shipping, existing branch draft/booking-homepage-2026-10-02.

The tracking card is capped at 600 CSS pixels on desktop, with reduced padding, heading size and input/button height. It aligns to the same starting edge as the hero copy: left for English and other LTR languages, right for Arabic/Urdu, consistent with the existing RTL hero. Tablet width stays within the text column. On phones the card fills the available content width and the input/button stack. The action retains a minimum 44-pixel height.

The release adds a scoped stylesheet only. It does not modify homepage body markup, text, tracking handlers, header controls, service selection, language dictionaries or image/logo assets. The build compares the entire homepage body before/after, versions the stylesheet and publishes tracking-layout-checks.json. No new email button is exposed without a working server-side verification service.

## Verification performed
- Five local Node tests passed: scope-preserving markup change, idempotency, wrong-page rejection, responsive/RTL style rules, and isolated build metadata/assets. These tests are added to the hosted build alongside the existing header and translation tests.
- 84 local Chromium layout cases passed: seven authored tracking languages at widths 320, 375, 390, 600, 601, 650, 768, 980, 1024, 1280, 1440 and 1920. Checks covered text-column alignment, width limits, input/button containment, minimum control height and page overflow.
- These are focused local geometry tests using the fetched original header CSS and the current hero layout rules. The harness uses a placeholder background and does not constitute a hosted browser visit, a full-site regression or an OTP-delivery test.
- The original header stylesheet copied for local testing matched Git blob e9171ee165f13abdbec10c11160f3a178227329b. It is not changed by this release.
- Publication must be confirmed by a live Render deployment before reporting the layout as published.

## Requested next feature: track by email
This section records the user's requested feature and intended access rules. Email OTP and shipment retrieval are NOT implemented or activated by this layout release.

Proposed journey: choose Track by email, enter the booking contact email or customer-account email, request a single-use email code, verify it, then view authorised shipment summaries with route, status, ETA and last-updated time. Keep reference-based tracking alongside this method in the same compact panel. An already authenticated customer can open My shipments without repeating verification during a valid session.

Access rules:
- Before successful verification, return a uniform acknowledgement without disclosing whether an address has shipments or an account.
- After verification, restrict results server-side to the explicit booking-contact association or the customer's approved company memberships. Email verification alone does not grant company access. Never infer access from a shared email domain, VAT number or a customer-supplied company ID.
- Guest verification grants a temporary read-only shipment-summary session. It must not silently create a full account, allow booking changes, expose documents/invoices or grant staff privileges.
- Only actual recorded ETA/status values are shown, with an updated-at timestamp and an estimated qualifier. Missing ETA is explicitly unavailable, never fabricated. The current request-review backend does not yet implement operational shipment milestones/ETA.

Authentication and release requirements:
- Generate codes on the server with a cryptographically secure generator, short expiry, single-use consumption, bounded verification attempts, resend cooldown and rate limits. Resending invalidates the previous code. Do not log codes or persist them in plaintext.
- Use an authenticated, short-lived secure server session after verification. Check shipment permissions on every list/detail request. Never put customer email or an OTP in a query URL or return shipment data before verifying the session.
- Configure an authorised transactional-email sender, deploy the authentication API/database and connect real customer-booking/shipment records to the staff dashboard. The static Booking Lab frontend cannot by itself deliver OTPs or authenticate private shipment data.
- Translate UI and email messages in EN, AR, RU, FR, UR, HI, ZH. Preserve typed customer data.
- Test actual delivery to a controlled mailbox, expiration/reuse/replay, wrong codes, rate limiting, enumeration resistance, company isolation, revoked access and real ETA updates before enabling the public email-tracking action.

Security references reviewed:
https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

No paid resources, mail credentials, existing staff accounts, customer data or production database configuration were changed. The older UKR deployments are untouched.
