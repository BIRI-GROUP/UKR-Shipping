# UKR Booking Lab: customer and staff backend foundation 01

## Confirmed working target

- Website: https://ukr-booking-lab.onrender.com
- Render service: `ukr-booking-lab`, ID `srv-db006v3tqb8s73e1caqg`
- Workspace: `tea-daic6soae00c73dt8oo0` (My Workspace)
- Repository: `BIRI-GROUP/UKR-Shipping`
- Working branch: `draft/booking-homepage-2026-10-02`
- Current Render configuration: static site, build `node preview/prepare.mjs`, publish `preview-dist`, automatic deployment OFF.
- Last live deployment checked: `dep-db031k6gekts738022g0`, commit `2ae3d99cf4628e6153884cf5d5de4574f80b76ff`.

These values were read from the connected Render service, not inferred from a preview image. All work in this step is limited to this repository branch. The homepage, logo, images and preview build are unchanged. The older preview/staff deployments are not edited, contacted by the new module, or redeployed.

The language commits are already on this working branch; the inspected live deployment predates them. A future deployment needs review of the complete branch, not just this module. No deployment is performed by this step.

## Implemented and locally tested

`services/booking-lab/schema.sql` is an explicit, additive database migration for customer identities, companies, approved memberships, booking requests and status/audit events. It references the existing staff identity table. It neither creates passwords nor provisions accounts. It is not automatically imported by an existing server.

`services/booking-lab/workspace.mjs` provides the common data layer for both dashboards:

- Customer overview and company-scoped booking list/detail. Only active, email-verified customers with active, approved company membership can access a company's requests. Matching email domains or submitting a VAT number never grants company access.
- Customer booking requests for seven services. FCL equipment remains distinct: 20GP, 40GP, 40HC and 45HC. DDP origin is CN, with AE/SA/OM/QA/KW destinations. Customs countries are AE/OM/SY/TR/GB/CA. Port inputs retain canonical codes. Fractional CBM is retained.
- Staff queues, assignment and review, reusing the existing `services/staff/policy.mjs` permissions as code. Roles and account activation are read afresh from the database. The first queue uses shipment permissions; departmental customs/warehouse/finance workflows remain follow-up work.
- Customer-safe field allowlists. Staff notes and assignee IDs are not exposed in customer booking DTOs. Customer timelines exclude staff-only note/assignment events and staff actor identities.
- Transactional submission, scoped idempotency keys, optimistic version checks and an audit trail. Duplicate retries do not create duplicate jobs; conflicting reuse produces a 409.
- Review states: submitted, under_review, information_required, ready_for_confirmation, cancelled. There is deliberately NO carrier-confirmed, paid or delivered state in this request-review foundation.

No new account sees demo shipments or invented balances. Empty counts come from the authenticated database scope. The module has no supplier pricing, carrier API or rates in public files.

`services/booking-lab/http.mjs` is a mountable Node handler, NOT an independently deployed API or a complete authentication implementation. It refuses construction without a server-session authenticator and transactional store. It uses same-origin and CSRF checks for writes, bounded JSON bodies, no-store responses and stable error/message keys for later seven-language UI mapping. It offers no default user, login bypass, public seed endpoint or listening socket.

## API contract for the dashboard integration

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/booking-lab/me` | Authenticated profile, memberships, scoped counters and capabilities |
| GET | `/api/booking-lab/bookings` | Scoped, paginated request list; optional companyId/limit/offset |
| GET | `/api/booking-lab/bookings/:id` | Authorized request details and filtered timeline |
| POST | `/api/booking-lab/bookings` | Customer request submission; Idempotency-Key header required |
| PATCH | `/api/booking-lab/bookings/:id` | Permitted staff review; current version required |

Mutation headers: `Content-Type: application/json`, exact configured `Origin`, session-bound `X-CSRF-Token`. The authenticator must derive kind, subject and CSRF token from a verified server session, never from body/query/identity headers. The workspace independently loads role, activation and membership from the database. Do not expose this handler before the real session and rate-limiting integration is implemented and tested.

Database interface: `query(sql, parameters)` returns `{rows,rowCount}`; `tx(fn)` must provide atomic transactions and serialize conflicting writes. The existing Postgres store uses a transaction-scoped advisory lock. Production needs an explicitly configured database; no in-memory fallback is provided by this module. Apply the existing staff schema first, then call `migrateWorkspace` explicitly during an approved migration. Database privileges must prevent end users editing membership, roles or audit tables directly.

Port-code validation checks identifier format, not terminal acceptance or carrier coverage. Named land/express locations are request inputs, not a route-availability guarantee. Container quantity, CBM and KG fields are intake data, not a tariff calculation. Final cargo, tariff, sailing, cancellation and payment approval remain separate.

## Tests actually run

Command: `node --test tests/booking-lab.test.mjs` on Node 22.16.0.

Result: **32 tests passed, 0 failed**. Tests use an isolated in-memory SQLite database with foreign keys and a local HTTP server. The existing staff policy file used locally matched Git blob `bf253269f1285c670fa678163a66fcdd44f04d1a`.

Coverage includes company isolation; membership and user revocation; no role elevation from request fields; read-only management; assigned staff; all seven services and four equipment sizes; fractional CBM; idempotency/retry conflicts; database rollback when audit insertion fails; optimistic conflict handling; filtered customer timelines; origin/CSRF checks; request size/type limits; and mandatory authentication injection.

The HTTP tests inject a synthetic identity. They verify the handler boundary, not a real login session, password hashing, reset flow, email delivery, MFA or rate limiter. PostgreSQL execution, account lifecycle, live migration, dashboard UI and end-to-end hosted deployment have NOT been tested or enabled. The network fetch of the public website did not succeed in this environment; target/deployment identification was verified through Render instead.

## Next integration stages in this same project

1. Implement and test customer account verification/invitations, staff-session integration, company approval, password reset and session expiry/revocation. No public staff registration. Keep customer-company membership independent of VAT entry.
2. Connect the existing `/portal.html` and `/staff.html` entry points to the common backend. Build customer Overview / Bookings / Quotations / Documents / Invoices / Profile, and staff Review queue / Customers / Jobs / Rates / Documents / Roles. Unimplemented modules must say coming soon, not display invented data.
3. Add approved rates and quotation snapshots, secure document storage, shipment execution and notifications. Supplier costs and margins stay server-side and permission-restricted.
4. Complete seven-language UI/error mapping in the agreed order EN, AR, RU, FR, UR, HI, ZH, including RTL for Arabic/Urdu. This backend returns language-neutral codes and unaltered customer text.
5. Approve a backend runtime/database and routing arrangement for the Booking Lab frontend. Render currently serves it as a static site; that service alone does not execute the authenticated Node handler. Preserve the chosen website address; do not silently substitute the older staging site. Confirm costs/configuration before creating paid resources or migrating data.

## References

- Render static/dynamic service distinction: https://render.com/docs/static-sites and https://render.com/docs/web-services
- Authorization principles: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

No existing runtime files, generated homepage, customer data, staff accounts, passwords, environment variables, rates, artwork or Render configuration were changed in this step. No production rollout or merge to main was performed. This is backend foundation code, not a claim that the dashboards are now live.
