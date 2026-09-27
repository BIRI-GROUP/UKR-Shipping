# UKR staff workspace — staging foundation

Owner email reserved for secure setup: `bayan@ukrshipping.com`.

The public airline-style quote-request preview remains at https://ukr-shipping-preview.onrender.com/. Staff uses a separate service and same approved blue brand. Public quote drafts remain browser-local and are not automatically imported into staff queues.

## Implemented

- Password login, 8-hour sessions, sign-out, current-password changes, owner-issued single-use password recovery links.
- First-owner setup is bound to the configured email and expiring token; only succeeds while the user table is empty.
- Super Admin creates 48-hour invitations, assigns roles, disables users and changes access. No invitations/emails are sent automatically.
- Thirteen server-enforced roles, seven departmental work queues, assignment restrictions, manager-only quotation/finance approval, optimistic version checking and an audit trail.
- First records are real user-created work items; no production demo accounts or invented operational records.
- Desktop and mobile UI with the approved blue UKR logo.

## Access levels

| Role | Editable work | Read-only work | Administration |
|---|---|---|---|
| Super Admin | All queues, assignment and approval | All | Staff, invitations, recovery, audit |
| Management | None | All queues | Audit |
| Sales Manager | All leads and quotation work; quotation approval | All shipment work | None |
| Sales | Own leads and quotation work; no approval | Assigned shipments | None |
| Operations Manager | All shipment, warehouse, customs, transport work | — | None |
| Operations | Assigned shipments | Assigned warehouse, customs, transport | None |
| China Manager | All warehouse/loading work | Assigned shipments | None |
| China Warehouse | Assigned warehouse/loading work | — | None |
| Customs | Assigned clearance work | Assigned shipments | None |
| Transport Manager | All transport/dispatch work | Assigned shipments | None |
| Dispatcher | Assigned transport/dispatch work | — | None |
| Finance Manager | All finance work and approval | All quotation work | None |
| Accounts | Assigned finance work; no approval | — | None |

Managers can assign to any active staff member with access to that queue. Assignment grants visibility, not additional edit rights. Roles are code-configured for this release; custom permissions/branches are not implemented yet. Records are currently limited to the most recent 200 per accessible queue; audit displays 100 recent events. No delete operation is exposed.

## Scope boundary

These are internal task queues with title, reference, status, notes and assignee. Updating a task does not issue a commercial quote, book a carrier, clear customs, post an invoice or transfer money. Shipment relationships, documents, rate tables, supplier costs, actual invoicing, customer access, notifications and carrier/warehouse integrations remain separate roadmap work. Do not put supplier costs in shared operational notes. Finance work is restricted to Finance, Management and Super Admin.

## Security and deployment

Server: Node 24, `services/staff/server.mjs`; Postgres through `pg`; frontend: `apps/staff/`.

Render free web service in Frankfurt:

```
Build: npm install --prefix services/staff --omit=dev
Start: node services/staff/server.mjs
Health: /healthz
```

Required configuration:

- `NODE_ENV=production`, `NODE_VERSION=24.19.0`
- `APP_ORIGIN=https://ukr-staff-staging.onrender.com` (must match actual service URL)
- `OWNER_EMAIL=bayan@ukrshipping.com`
- `DATABASE_URL`: dedicated UKR Postgres internal connection URL in the same region. Never commit it.
- `SETUP_TOKEN_HASH`: SHA-256 of a random 32-byte base64url owner setup token; only its hash belongs in service configuration.
- `SETUP_EXPIRES_AT`: epoch milliseconds, normally 24 hours from issuing the private setup link.

Owner privately opens `APP_ORIGIN/#setup=TOKEN`, enters matching email and chooses their password. Token is removed from the address bar by the frontend. No owner password is generated or committed. After completion, remove the setup environment values. If the sole owner loses access, an operator must perform a verified owner recovery; public reset is intentionally unavailable.

Passwords use scrypt (N=32768, r=8, p=3, 16-byte random salt, 64-byte output). Opaque session/activation tokens are hashed in storage. Sessions use Secure, HttpOnly, SameSite=Strict cookies. Mutations require exact Origin and session CSRF token. Password changes, recovery and access changes revoke sessions. Privileged writes revalidate the session inside the same serialized transaction. Last active Super Admin cannot be disabled/demoted. Invites and resets issued by removed administrators become invalid. Login throttling is persisted. SQL is parameterized; UI renders user content with textContent. No secrets enter audit details.

Missing `DATABASE_URL` leaves the public login page available but disables login/account creation; API writes return 503. There is no production SQLite/in-memory fallback. Tests use only disposable in-memory SQLite with `NODE_ENV=test`; this verifies application behavior but is not PostgreSQL integration verification.

The dedicated UKR database `dpg-dasl0n7pn0mc738sle8g-a` was provisioned on 27 September 2026 after explicit approval: PostgreSQL 18, Frankfurt, 0.1c-256mb, 1 GB storage, storage autoscaling disabled. Approximate approved charge: US$6.30/month before tax. Its external IP allowlist is empty; the staff app uses the internal connection URL. The unrelated BIRI database was not modified. Render free web services can sleep when idle and are for staging. MFA, backup-restore drills, durable external audit export, email delivery and authenticated persistence/redeploy verification are launch follow-ups.

## Verification

`node --test tests/staff.test.mjs tests/freight-rules.test.cjs`

Tests cover setup identity/token/single-use, login failures, SQL-injection-style input, Origin/CSRF, invitation identity/replay, department/assignment isolation, read-only roles, manager approval, stale writes, deactivation, last-owner protection, recovery expiry/replay, session revocation/expiry, throttling, secret-free audit and fail-closed missing database.

Local browser fixture: `node tests/serve-staff-preview.mjs` at `http://127.0.0.1:4180`. Its synthetic credentials and data never enter the deployed service. Desktop 1440×1000 and mobile 390×844 verified login, restricted navigation, assignment, update and layout without horizontal page overflow.
