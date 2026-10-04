# Private portal review with test code 1234

## Purpose and target

The owner requested online staff and customer access now, with email integration later. This release runs on the existing paid `ukr-staff-staging` service at `/staff/` and `/customer/`. No new paid service or database is provisioned. DNS, the public Booking Lab design and the existing legacy application endpoints remain unchanged.

This is an explicitly nonproduction, private user-acceptance-test workspace. It is not a public email-plus-1234 login for real customer data and does not complete the remaining logistics phases.

## Access

A cryptographically random private access key is required before any review identity, login form or booking API becomes available. The key is submitted by a native same-origin POST form. It is never embedded in repository files or a URL query. Only its hash is configured on Render. The browser retains an eight-hour Secure, HttpOnly, SameSite=Strict gate cookie. The entire review expires at the configured deadline within fifteen days. Gate changes and expiry revoke access.

Inside the gate, staff retain password plus test code 1234. The first review owner is explicitly created by the owner using `bayan@ukrshipping.com`, a name and a chosen password. This is separate from, and does not reset or replace, any legacy staff account. No staff password is seeded or shared in the repository.

Customer review logins accept only `customer@ukr.test` and `second.customer@ukr.test`, followed by 1234. Accounts are created by the existing verified-session workflow on first test login. Real customer addresses are refused. Sharing the private key grants access to this test workspace and must be treated as a secret. This is not production-grade customer email verification.

No email is sent. Fixed-code challenges retain attempt limits, cooldown, expiry, single-use consumption and server-session/CSRF checks. Production startup cannot enable this test mode. The review is restricted to the approved staging hostname; localhost is allowed only in tests.

## SQL and data boundaries

Only a new `ukr_portal_test` schema in the existing dedicated UKR PostgreSQL database is created and migrated. Every review connection has a fixed search_path excluding public. The current schema is checked before invoking the existing numbered migrations, and migration checksums are verified. No operational staff, customer, booking, rate, invoice or shipment record is copied into the review. Existing public-schema endpoints use their existing separate connection and authentication.

Test records persist across application redeploys until explicitly removed. They are not held in browser storage or ephemeral local files. Enter test data only. No file-upload, operational backup or production-disk readiness is asserted by this SQL-only review release. The production startup checks remain intact.

## Connected screens

The existing Phase 1 staff overview, roles, settings, Masters, customers, preferences, tasks and approvals are reused. A shared review UI now connects customer Dashboard/My Shipments and Booking to the existing Phase 2 booking API. A customer creates a profile/company and submits a test booking, then sees its generated UKR reference and saved details. The staff service list reads the same record and allows authorised ETA edits with a reason and version check. Customer read models exclude internal fields and remain company-scoped. A second customer cannot read another company's bookings.

Use separate browser profiles or a private window when reviewing staff and customer sessions simultaneously. They intentionally share one application session cookie, not two unrestricted identities in one browser session.

Operational acceptance, consolidation, Goods In, invoices/payments, release/delivery, file uploads, carrier status APIs, real customer entry and email delivery remain separate unfinished work. The dashboard does not fabricate financial balances or tracking progress. Unimplemented screens retain their unavailable states.

## Verification

The private-review GitHub Actions job uses Node 24 and a disposable PostgreSQL 18 database. Existing authentication/database tests, new review HTTP/PostgreSQL tests, the existing authenticated Phase 1 browser suite, and the new anonymous private-entry browser matrix passed on implementation commit 3c3b32804b64515f91b9ee5179dfcbd2f5691d76.

New HTTP tests exercise production/host/schema refusal, signed gate expiry/tampering, anonymous denial, explicit owner setup, required staff password, wrong/reused codes, restricted customer emails, company-scoped test bookings, durable SQL writes, and preservation of a public-schema sentinel. The test namespace is removed after each run. The test message outbox contains zero sent messages.

New anonymous browser tests cover both entry points, seven languages and 390/1440-pixel layouts. They verify the private native form and deny visibility of the identity form before the private gate. Existing Phase 1 browser tests cover authenticated sessions separately. A new complete authenticated browser journey through the private gate and booking screens has NOT been run; HTTP tests do not substitute for that check.

The live-portals script performs read-only checks of the actual Render URLs after main publication. It requires the exact review release, private gate, seven languages and anonymous API denial. It submits no credentials, creates no customer records and sends no emails. Deployment and live checks must be verified separately before reporting the URLs as live.

## Activation and rollback

Only after the tested PR is approved for publication, merge the release and enable the explicit review environment with the private hash, separate encryption key, fixed schema and expiry. Existing DATABASE_URL and all legacy credentials remain unchanged. Disabling review and restoring NODE_ENV=production and AUTH_TEST_MODE=false restores guarded normal portal mode; the review schema remains retained, not deleted. DNS stays unchanged. No access key or encryption secret belongs in this note.
