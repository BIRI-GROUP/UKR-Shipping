# Phase 1: database, authentication and portal foundation

## Scope
This phase extends the existing UKR Node 24 service and reuses its scrypt passwords, staff identities and invitation/setup flows. The public Booking Lab artwork and search code are unchanged. Staff and customers have two entry points in one backend: `/staff/` and `/customer/`.

The earlier delivery-status note described a blocked upload. Application source is now committed on `phase/01-foundation-2026-10-04`; it is no longer accurate to say only CI exists.

## Implemented
- Numbered additive PostgreSQL migrations with checksums, explicit foreign keys, metadata, indexes, decimal money and append-only audit/history. Existing tables are retained. No commercial rates, shipments or passwords are seeded.
- Existing staff email/password followed by OTP; customer email OTP; pending identities, verified/invited company membership, revocation, same-origin/CSRF controls and opaque server sessions. Production codes are random six-digit, expiring and single-use with attempt limits and cooldown. Fixed-code mode requires test/development and an explicitly named test database. Production refuses that mode.
- SQL roles/permissions, warehouse and currency scopes, user invitations/recovery/disable, protected final Super Admin, searchable logs and editable permission matrix.
- Staff sidebar and scoped overview; customer profile/company/member/appearance screens. New accounts show actual empty states.
- Company, warehouses, currencies, configurable taxes, account/product trees, themes and SQL language/style/font/density preferences.
- FX confirmation, previous-rate display, threshold approval, Dubai-time grace rules and deduplicated reminder generation.
- Rule-driven Task Center, comments, calendar/due dates, suggestions and approval/correction history with no self-approval.
- Editable email templates and encrypted outbox. No delivery worker is activated. Private disk abstraction and encrypted database/file backup command; operational configuration remains a deployment prerequisite.

## Verified
Node 24.21.0 and real PostgreSQL 18 were used locally and in GitHub Actions.
- 65 existing SQLite/commerce/booking regressions passed, zero skipped.
- 42 Phase 1 unit/PostgreSQL checks passed, zero skipped.
- 60 authenticated Chromium assertions passed over a real local HTTP server and PostgreSQL database: staff password + OTP, customer OTP in seven languages, menus, server denial of customer access to staff endpoints, RTL and desktop/tablet/mobile checks.
- The first Chromium run found an asynchronous OTP form bug. Capturing the form before awaiting verification fixes the completed login; the test now covers actual browser sessions, not only API responses.
- GitHub Actions run `37196855516`, commit `a14bc47da703bc221efd6455de934a299671fee0`, completed successfully with those gates.

These checks do not claim delivery of real email, production restore verification, carrier tracking or later-phase operations. Fixtures use isolated database schemas and reserved test addresses; no real customer records are used.

## Running
Install dependencies in `services/staff`. Apply migrations explicitly with `node services/staff/phase1/db.mjs --apply` against the intended database after a verified backup. Start with `node services/staff/phase1/start.mjs`. Production requires HTTPS origin, DATABASE_URL and a private PORTAL_ENCRYPTION_KEY. Never publish keys or enable test mode on an operational service.

For tests use a disposable database named with `test`, NODE_ENV=test and AUTH_TEST_MODE=true. Run `node --test --test-concurrency=1 tests/phase1/*.test.mjs` and `node tests/browser/phase1.mjs`. Browser evidence is attached to the Actions run.

## Deployment prerequisites
The existing staff Render service follows `main` on a free plan; its existing UKR database blocks external connections. No allowlist or real database data was changed. Operational uploads/backups need the owner-approved persistent disk and suitable web-service plan. Real OTP delivery needs an authorised SMTP sender configured securely and verified with a controlled mailbox. Test OTP is not a production substitute.

The subsequent owner request authorises continuing all eight phases and deploying tested releases to the specified UKR test sites. Separate phase branches/PRs remain the audit units. No unquoted paid upgrade, live mailbox connection or real customer email is inferred. ukrshipping.com remains outside deployment scope.
