# Staff workspace staging verification — 27 September 2026

## Deployed

- Public preview: https://ukr-shipping-preview.onrender.com/
- Staff preview: https://ukr-staff-staging.onrender.com/
- Source: BIRI-GROUP/UKR-Shipping, main, application revision `177c414cd7a0be59ba29d36aebe0881ddbf26fb4`.
- Render staff service `srv-dasko9gjo6nc73c7lodg`, Frankfurt, free plan.
- Staff deploy `dep-daskoq8ae00c73b7i4b0`: live.
- Public deploy `dep-daskoq8ae00c73b7i4f0`: live.
- Build installed the pinned pg dependency successfully; npm reported zero known vulnerabilities at build time.

## Passed

- `node --test tests/staff.test.mjs tests/freight-rules.test.cjs`: 16 passed, 0 failed.
- Local desktop 1440×1000: synthetic owner login, warehouse task creation, assignment to a synthetic warehouse employee.
- Local mobile 390×844: synthetic warehouse login shows only Overview, China warehouse, My access and Password. Assigned task visible and successfully updated from Expected to Measured. Reload retains session and saved work in the running test database. No horizontal page overflow.
- Live staff desktop and mobile: approved logo, readable login, disabled sign-in with clear database-pending notice, all 13 access descriptions render in responsive dialog.
- Live public preview: new Staff login links exist in desktop and mobile navigation; mobile link reaches correct staff service. Freight search still returns sea/air request-only options without invented prices. No horizontal overflow at 390px.

## Activation blocker

First owner email is `bayan@ukrshipping.com`. The user explicitly approved a dedicated 1 GB UKR database at approximately US$6.30/month before tax. Render rejected creation with HTTP 402: Payment information is required. The user must add a payment method at https://dashboard.render.com/billing. No database was created and no UKR staff account/password has been stored.

The workspace's existing free database belongs to BIRI; it was not reused or modified. No fake production accounts or temporary storage fallback was enabled.

After billing is ready: create the approved UKR Postgres instance in Frankfurt, securely set its internal DATABASE_URL on this service, generate a short-lived first-owner setup token (store only its hash), redeploy, verify schema and PostgreSQL persistence, and give the owner their private password setup page. Account password entry remains with the owner. Do not claim authenticated production testing or durable persistence until this is verified.
