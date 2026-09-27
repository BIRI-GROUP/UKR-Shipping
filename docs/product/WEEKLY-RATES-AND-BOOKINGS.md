# Weekly rates and website bookings

The staging website and staff platform now share the dedicated UKR PostgreSQL database through the staff service API. The public preview URL remains https://ukr-shipping-preview.onrender.com/ and the staff URL remains https://ukr-staff-staging.onrender.com/.

## Owner workflow

1. Sign in as Super Admin and open **Weekly rates**.
2. Add a route and product: 20 ft, 40 ft, 40 HC, LCL, LCL DDP, air, air DDP, or shared truck.
3. Set the cargo-ready validity dates, currency, buying cost and percentage or fixed markup per chargeable unit.
4. Set charging rules, minimums, rounding, cargo limits, extra selling charges, inclusions and exclusions. DDP also requires a defined delivery area and explicit confirmation of duty/tax treatment.
5. Choose automatic UKR acceptance or staff confirmation with a target in minutes.
6. Publish. Matching customer searches use the new rate. **Copy to next week** creates a draft for review; it does not publish automatically.

No commercial rates are seeded. Prices appear only after the owner enters and publishes actual tariffs. Only Super Admin can read buying costs and manage rates in this release; purchasing/accounts delegation is reserved for a future permission update.

## Calculation rules

- Sea shared cargo defaults to the user's UKR conversion: greater of CBM or gross kg / **475**, followed by the tariff minimum and upward rounding.
- Shared truck defaults to **350 kg/CBM**, editable to **300** or the applicable route conversion.
- FCL is priced per container, with a separately entered per-container weight limit. The customer currently supplies total shipment weight; individual container weights still require operational verification.
- Air defaults to greater of actual kg or CBM × 1,000,000 / 6,000, with an editable divisor and rounding.
- Markup percentage is added to cost, not calculated as gross margin. Fixed markup is added per chargeable unit.
- Extra origin, destination and documentation selling charges are added once per shipment in the tariff currency. No automatic currency conversion, duty calculation or tax inference occurs.
- Special handling and exceeded cargo limits produce a staff quotation request. Door delivery requested against a terminal-only rate requires staff review.
- A route matches its normalized origin/destination labels exactly. Published routes are added to the public location suggestions. Ports are not silently substituted.
- Overlapping published validity windows for the same route and product are rejected. Expired rates are excluded from new estimates.

## Booking behavior

The server recalculates every submission and rejects a changed or withdrawn tariff. A retry key prevents duplicate submissions. The accepted estimate and conditions are stored as an immutable snapshot alongside the customer's submitted cargo and contact details.

Requests receive a UKR booking-request reference. Eligible auto-accepted bookings, and requests explicitly accepted by staff, receive an immutable UKR shipment reference. UKR acceptance does not reserve carrier space. Special handling still requires operational review, and DDP coverage must be verified against the published scope.

The **Website bookings** page is available to Super Admin, management, sales managers and operations managers. Management is read-only. Authorized operators can review, accept, decline or cancel requests. Confirmation targets produce a due time and an overdue indicator when the page is refreshed; expiry never accepts a booking automatically.

This release records bookings in the staff dashboard. It does not send email/SMS notifications, take payments, reserve carrier capacity, or connect the existing sample tracking widget to live milestones. Staff must monitor Website bookings. Generic department work queues remain separate from these booking records.

## Security and verification

Public responses use explicit field allowlists and never include buying costs, markup, supplier notes or staff records. Staff writes retain session, origin, CSRF and role checks. Customer contact data is submitted only at final booking submission; estimate refreshes send cargo and handling flags. The database remains private to Render.

Automated tests cover sea/truck/air/FCL calculations, markup, validity, DDP validation, role restrictions, origin checks, price snapshots, changed-price rejection, retry deduplication, confirmation timing and automatic versus manual acceptance. Browser verification uses a disposable local database and synthetic rates/customers, with desktop and 390 px mobile layouts.
