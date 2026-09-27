# Weekly rates and website bookings

The staging website and staff platform now share the dedicated UKR PostgreSQL database through the staff service API. The public preview URL remains https://ukr-shipping-preview.onrender.com/ and the staff URL remains https://ukr-staff-staging.onrender.com/.

## Owner workflow

1. Sign in as Super Admin and open **Routes & services**. Add each regular port/hub pair once, its countries, served city aliases, air hubs and enabled products. Deactivate a route to stop showing its services without deleting its records.
2. Open **Weekly rates & Excel**. Select the week start and download an .xlsx workbook containing every active route/service. Products include air, LCL, DDP*, 20 ft, combined 40 ft DC/HC, 45 ft, air DDP and shared truck. Existing separate 40 HC tariffs are retained as legacy data.
3. Set the cargo-ready validity dates, currency, buying cost and percentage or fixed markup per chargeable unit.
4. Set charging rules, minimums, rounding, cargo limits, extra selling charges, inclusions and exclusions. DDP also requires a defined delivery area and explicit confirmation of duty/tax treatment.
5. Choose automatic UKR acceptance or staff confirmation with a target in minutes.
6. Upload the workbook and inspect the row-by-row preview before choosing **Save all as drafts** or **Publish these rates**. Rows without buying costs are skipped. Invalid rows or stale versions prevent the whole import from saving. Formulas, macros and external links are rejected; paste plain values. Imports are limited to 500 service rows and 1 MB files.
7. Manual rate entry and **Copy to next week** remain available. Matching customer searches use published rates; drafts remain private.

No commercial rates are seeded. Prices appear only after the owner enters and publishes actual tariffs. Only Super Admin can read buying costs and manage rates in this release; purchasing/accounts delegation is reserved for a future permission update.

## Calculation rules

- Sea shared cargo defaults to the user's UKR conversion: greater of CBM or gross kg / **475**, followed by the tariff minimum and upward rounding.
- Shared truck defaults to **350 kg/CBM**, editable to **300** or the applicable route conversion.
- FCL is priced per container, with a separately entered per-container weight limit. The customer currently supplies total shipment weight; individual container weights still require operational verification.
- Air defaults to greater of actual kg or CBM × 1,000,000 / 6,000, with an editable divisor and rounding and at least a 5 kg minimum.
- Markup percentage is added to cost, not calculated as gross margin. Fixed markup is added per chargeable unit.
- Extra origin, destination and documentation selling charges are added once per shipment in the tariff currency. No automatic currency conversion, duty calculation or tax inference occurs.
- Special handling and exceeded cargo limits produce a staff quotation request. Door delivery requested against a terminal-only rate requires staff review.
- City/country search uses the explicit mappings configured on permanent routes. A country with several matching routes returns a choice of routes. Mapped ports and air hubs are shown to the customer. No geographic nearest-port guess is made.
- Overlapping published validity windows for the same route and product are rejected. Expired rates are excluded from new estimates.

## Booking behavior

DDP* always requires final approval of goods value and commodity, even if automatic acceptance is selected for a tariff. EXW pickup plus export customs also always requires review of the supplier address and cargo. The owner can enter an EXW customer starting charge per shipment in Excel or manually. A blank EXW charge requires quotation; zero means it is included. When selected, the starting charge is included once in the estimate.

The server recalculates every submission and rejects a changed or withdrawn tariff. A retry key prevents duplicate submissions. The accepted estimate and conditions are stored as an immutable snapshot alongside the customer's submitted cargo and contact details.

Requests receive a UKR booking-request reference. Eligible auto-accepted bookings, and requests explicitly accepted by staff, receive an immutable UKR shipment reference. UKR acceptance does not reserve carrier space. Special handling still requires operational review, and DDP coverage must be verified against the published scope.

The **Website bookings** page is available to Super Admin, management, sales managers and operations managers. Management is read-only. Authorized operators can review, accept, decline or cancel requests. Confirmation targets produce a due time and an overdue indicator when the page is refreshed; expiry never accepts a booking automatically.

This release records bookings in the staff dashboard. It does not send email/SMS notifications, take payments, reserve carrier capacity, or connect the existing sample tracking widget to live milestones. Staff must monitor Website bookings. Generic department work queues remain separate from these booking records.

## Security and verification

Public responses use explicit field allowlists and never include buying costs, markup, supplier notes or staff records. Staff writes retain session, origin, CSRF and role checks. Customer contact data is submitted only at final booking submission; estimate refreshes send cargo and handling flags. The database remains private to Render.

Automated tests cover sea/truck/air/FCL calculations, markup, validity, DDP validation, role restrictions, origin checks, price snapshots, changed-price rejection, retry deduplication, confirmation timing and automatic versus manual acceptance. Browser verification uses a disposable local database and synthetic rates/customers, with desktop and 390 px mobile layouts.

## Customer discovery and Magic tool

The website begins with location search and a cargo-ready date. Quick view lists all enabled services, starting selling prices, units, minimums, validity and EXW starting charges. Routes remain discoverable when prices expire; missing prices show a quotation request. Selecting an option opens the detailed weight/CBM estimator and existing booking flow.

The Magic tool uses item cost, quantity, packed length/width/height and packed weight to calculate total CBM/weight and query actual published tariffs. It shows air and sea shipping totals and estimated cost per item. Optional selling price shows estimated profit and margin before any unentered costs. Customers enter other excluded costs for the whole shipment. Tariffs are compared only in the chosen input currency; no FX assumptions are made.

An FCL option is shown when volume reaches 85–100% of the owner-entered container planning capacity and declared weight is within the per-container limit. Capacity zero disables that suggestion. For combined 40 ft rates, use the smaller DC planning capacity. This is a volume/weight suggestion, not a physical packing or carrier-capacity guarantee.

Verification for this revision includes 33 automated checks plus local browser route creation, .xlsx upload preview and publication, city mapping, six-option quick view, manual rate entry, EXW estimate, 45 ft selection and Magic tool profit/container output. No synthetic rates or customers are deployed to the live database.
