# UKR implementation progress

Source of scope: PROJECT-DIRECTORY.md, SERVICE-CATALOG.md, SMARTLOAD.md and the UKR Master Build discussion. Blue branding supersedes the earlier navy/gold direction. Staging stays at https://ukr-shipping-preview.onrender.com/.

## Delivered in staging

- Approved blue logo in header, footer and customer preview; responsive blue visual system.
- Route/cargo search with validation, container equipment/count and consistent sea/air eligibility.
- Service comparison with explicit request-only availability. Removed fabricated prices and transit promises while no verified rate source is connected.
- Functional service selection, cargo/contact form, handling flags, delivery preferences and editable request review.
- Browser-local request drafts that can be saved, reopened and removed. No server submission and no shipment ID is issued.
- Print-ready request review, marked as a draft rather than a formal quote.
- China operations and customs inquiry entry points.
- Calculator validation and two-decimal results. Sample tracking only accepts its actual sample reference.
- Separate staff workspace at https://ukr-staff-staging.onrender.com/ with password/session authentication, 13 server-enforced staff roles, departmental work queues, invitations, password recovery, account deactivation and audit history. Linked from desktop/mobile public navigation. See STAFF-PLATFORM.md for scope and access matrix.
- Dedicated 1 GB UKR PostgreSQL 18 database provisioned in Frankfurt on the approved approximately US$6.30/month plan and connected over Render's private network. Deployment succeeded with schema initialization and live sign-in enabled. Private, expiring owner setup supplied for bayan@ukrshipping.com; password entry remains with the owner.

## Next backend foundation, in master-plan order

1. Configurable service catalog and route availability matrix, including ONLINE RATE, STAFF-CONFIRM, REQUEST ONLY, TEMPORARILY SUSPENDED and UNAVAILABLE.
2. PostgreSQL model and migrations: customers, contacts, leads, quotes/versions, cargo and events. Server-generated immutable shipment identity when booking creates a shipment.
3. Finish owner onboarding and verify account/work persistence after redeploy. Staff roles, PostgreSQL connection and audit events are implemented; customer authentication and company scoping remain to build. Internal costs and notes must remain excluded from customer responses.
4. Lead submission API, staff review queue and CRM. Replace local draft save with a clearly acknowledged server submission while retaining draft editing.
5. Verified rates, validity windows, charge breakdowns, quote approvals and formal PDF versions.
6. Booking confirmation, shipment milestones, document storage and customer portal tied to real records.

## Remaining planned modules

China warehouse receipts/consolidation, LCL/FCL/Air/DDP execution, staff Control Tower, fleet and dispatch, finance/invoices, rules-based SmartLoad with staff approval, notifications, SEO/service-page rebuild, WordPress theme plus functionality plugin, integrations and reporting.

## Release boundaries

The public deployment is an interactive frontend preview. It does not persist public requests on a server, notify UKR staff, accept payments or confirm bookings. The staff backend runs on a free web service with a dedicated paid PostgreSQL database; it uses no production in-memory fallback. The database was provisioned after explicit cost approval and billing setup. Staff work items are internal tasks, not commercial quotes, shipments or financial transactions. Existing production domains and WordPress content are untouched. Public URLs must follow the existing website audit during the WordPress migration.

## Validation for this iteration

- Five automated rule tests: invalid route/cargo/date, container restrictions, absence of fabricated rates, gross-margin calculations and handling review flags.
- Browser testing at desktop 1440px and mobile 390px/320px: request selection, form validation/review, local draft persistence/reopen, container selection and horizontal overflow.
- Print stylesheet implemented; native print/PDF dialog not exercised automatically.
- Staff: all 16 combined automated tests passed (authentication/authorization integration and public freight rules), local authenticated desktop/mobile workflows verified, and deployed login/access-panel and public link verified on desktop/mobile. Live PostgreSQL schema initialization and database-connected startup passed on 27 September 2026. Owner onboarding and authenticated live-session/persistence testing await the owner's password setup.
