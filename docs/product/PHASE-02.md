# Phase 2: shared booking intake and customer read model

## Implemented application code

Application commit: `15c3451e6d5b1a867a5d74d1459a0c376ed176a0` on `phase/02-shared-jobs-2026-10-04`.

This adds application logic, not only test infrastructure. It extends the existing Phase 1 authenticated API. The public Booking Lab files and Render configuration are unchanged.

- One shared booking-intake implementation for the configured service families. Staff submit against an existing customer; customer submissions derive company and identity from the server session.
- Server-generated UKR booking codes and source labels. Prices, assignments, company identity and operational status cannot be supplied as arbitrary intake fields.
- Required legal-owner name, phone, route and cargo description; optional shipper contacts and warehouse references. Contact email comes from the linked customer identity.
- SQL-backed retry protection, transactional submission, a customer-visible submission event, the existing rule-driven review task, and audit records.
- Paginated staff/customer booking lists and details, ordered by ETA. Customer data is company-scoped; pending company owners may read their own requests only. View-only members cannot submit.
- Staff ETA updates with required reason, optimistic revision checks and recorded ETA history. Internal reasons remain in staff audit, not customer events.
- Explicit response allowlists exclude purchase prices, agreement internals, staff assignments and internal notes from customer responses. Container numbers are not returned by this intake read model.
- Fresh account, permission and membership checks on every operation. Revoking membership or disabling an account immediately prevents access.

## Integration points

All paths are under the existing `/api/portal` prefix and retain its server sessions, Origin and CSRF checks:

- GET `/bookings`: scoped list with limit, offset and optional service.
- POST `/bookings`: validated intake; `request_key` in the JSON body is required.
- GET `/bookings/:id`: authorised details, items and filtered timeline.
- PUT `/bookings/:id/eta`: authorised staff ETA change with version and reason.

`services/staff/phase1/api.mjs` routes these paths into `services/staff/phase2/bookings.mjs`. Exported service operations require the surrounding transaction used by the existing portal HTTP handler. No unauthenticated endpoint or alternate login is added.

## Data-model supplement

Numbered migration `0005_booking_intake.sql` adds contact/shipper fields and origin/destination warehouse references to the existing bookings table. Existing records retain null legacy contact fields rather than invented values. Booking codes, source, customer, company and service become immutable at the SQL boundary.

The `booking_submissions` table links a user-scoped hashed retry key and payload hash to one booking. It has explicit user/booking foreign keys, unique scope, common metadata and indexes. A PostgreSQL sequence issues new booking codes. Sequence gaps after rollback are permitted; codes are never reassigned. Booking status events gain an event kind and ETA snapshot. No operational data is seeded.

## Verification actually completed

GitHub Actions run `37213024548` tested application commit `15c3451` with Node 24.21.0 and PostgreSQL 18.6. The Phase 2 test command completed with **26 tests passed, 0 failed, 0 skipped**. This comprises 11 policy tests, 14 database subtests and their parent suite test.

Database checks cover repeated migrations, staff-created bookings readable by the linked customer, pending-company intake, duplicate retries and conflicts, ETA persistence, stale updates, cross-company denial, view-only accounts, revocation, rollback, identity immutability and field filtering. Test accounts use reserved example.test addresses and an isolated schema that is removed afterwards.

The existing portal validation run `37213024559` also passed its existing-regression, Phase 1 PostgreSQL/unit and authenticated-browser steps on this commit. Those existing browser tests do not constitute an end-to-end browser test of the new booking interface. The Phase 2 browser step was skipped because its UI journey test is not yet implemented. The Phase 2 API tests inject test actor contexts; they are not a live OTP-email delivery test.

## Not yet delivered by this commit

This is a tested booking-intake/backend increment, not completion of Phase 2 or any later phase. The new booking screens and seven-language messages are not connected yet. Staff entry of already-in-transit historical shipments, acceptance and rate locking, 30-minute fallback sales assignment, Goods In, consolidation, document generation, final checks, invoices, payments, release and delivery still require implementation/integration.

Real emails, live OTP delivery, operational database migrations, disk/backup configuration, deployment and new customer data entry have not been activated. Nothing here claims that a shipment was carrier-booked, moved, paid or delivered. No Phase 2 completion PR is opened until the remaining scope and authenticated end-to-end tests are finished.
