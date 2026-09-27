# Staff workspace staging verification — 27 September 2026

## Deployed

- Public preview: https://ukr-shipping-preview.onrender.com/
- Staff preview: https://ukr-staff-staging.onrender.com/
- Source: BIRI-GROUP/UKR-Shipping, main, application revision `177c414cd7a0be59ba29d36aebe0881ddbf26fb4`.
- Render staff service `srv-dasko9gjo6nc73c7lodg`, Frankfurt, free plan.
- Staff deploy `dep-daskoq8ae00c73b7i4b0`: live.
- Database activation deploy `dep-dasl2d8u01pc73ceavn0`: live, 27 September 2026 at 17:24 UTC, revision `dec306c831a92786458c7cdb87936e20270d2c3f`.
- Public deploy `dep-daskoq8ae00c73b7i4f0`: live.
- Build installed the pinned pg dependency successfully; npm reported zero known vulnerabilities at build time.

## Passed

- `node --test tests/staff.test.mjs tests/freight-rules.test.cjs`: 16 passed, 0 failed.
- Local desktop 1440×1000: synthetic owner login, warehouse task creation, assignment to a synthetic warehouse employee.
- Local mobile 390×844: synthetic warehouse login shows only Overview, China warehouse, My access and Password. Assigned task visible and successfully updated from Expected to Measured. Reload retains session and saved work in the running test database. No horizontal page overflow.
- Live staff desktop and mobile: approved logo, readable login and all 13 access descriptions render in responsive dialog. Initially failed closed while awaiting database; sign-in became enabled after the database activation deployment.
- Live public preview: new Staff login links exist in desktop and mobile navigation; mobile link reaches correct staff service. Freight search still returns sea/air request-only options without invented prices. No horizontal overflow at 390px.

## Database activation

First owner email is `bayan@ukrshipping.com`. The user explicitly approved a dedicated 1 GB UKR database at approximately US$6.30/month before tax and added billing information. Database `dpg-dasl0n7pn0mc738sle8g-a` was created successfully: PostgreSQL 18, Frankfurt, 0.1c-256mb, 1 GB, autoscaling disabled. Status available. External access is blocked by an empty database IP allowlist.

The internal DATABASE_URL was transferred directly from the Render database dashboard into the staff service environment without being printed or committed. A random 32-byte owner setup token was generated; only its SHA-256 hash and 24-hour expiry were configured on the service. The private link was supplied only in the owner conversation, never in repository files.

The activation deployment completed successfully. Startup initializes schema in a PostgreSQL transaction before logging `UKR staff service ready; database=true`. The live login page enables sign-in and no longer shows the database-pending notice. Direct read-only MCP SQL inspection is blocked by external networking restrictions; these were not weakened for testing.

The workspace's existing free database belongs to BIRI; it was not reused or modified. No fake production accounts or temporary storage fallback was enabled.

Remaining onboarding: owner chooses their password on the private setup page and signs in. Then verify authenticated dashboard/session persistence, inspect user/audit counts through the authorized app, and remove setup configuration. Account password entry remains with the owner. Do not claim authenticated live testing or account/work persistence after a restart until verified.
