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

## Next backend foundation, in master-plan order

1. Configurable service catalog and route availability matrix, including ONLINE RATE, STAFF-CONFIRM, REQUEST ONLY, TEMPORARILY SUSPENDED and UNAVAILABLE.
2. PostgreSQL model and migrations: customers, contacts, leads, quotes/versions, cargo and events. Server-generated immutable shipment identity when booking creates a shipment.
3. Authentication and server-side permissions: customer access scoped to their company; staff roles and audit events. Internal costs and notes excluded from customer responses.
4. Lead submission API, staff review queue and CRM. Replace local draft save with a clearly acknowledged server submission while retaining draft editing.
5. Verified rates, validity windows, charge breakdowns, quote approvals and formal PDF versions.
6. Booking confirmation, shipment milestones, document storage and customer portal tied to real records.

## Remaining planned modules

China warehouse receipts/consolidation, LCL/FCL/Air/DDP execution, staff Control Tower, fleet and dispatch, finance/invoices, rules-based SmartLoad with staff approval, notifications, SEO/service-page rebuild, WordPress theme plus functionality plugin, integrations and reporting.

## Release boundaries

The current deployment is an interactive frontend preview. It does not provide real login, persist requests on a server, notify UKR staff, accept payments or confirm bookings. No new hosting plan/database was purchased. Existing production domains and WordPress content are untouched. Public URLs must follow the existing website audit during the WordPress migration.

## Validation for this iteration

- Five automated rule tests: invalid route/cargo/date, container restrictions, absence of fabricated rates, gross-margin calculations and handling review flags.
- Browser testing at desktop 1440px and mobile 390px/320px: request selection, form validation/review, local draft persistence/reopen, container selection and horizontal overflow.
- Print stylesheet implemented; native print/PDF dialog not exercised automatically.
