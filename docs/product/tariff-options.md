# Weekly tariff options

Rates support `selling` price entry without fabricating a buying cost, or the existing `buying_markup` entry. Existing known purchase costs can be retained when switching to a direct selling price. Public responses continue to use an explicit allowlist and never return purchase costs or private notes.

`AIR_EXPRESS` is a separate product from economy `AIR`. An idempotent startup migration enables it on the approved China routes already operating AIR. It creates no prices.

Optional LCL selling tiers cover up to 5, above 5 through 10, above 10 through 20, and above 20 chargeable CBM. The whole chargeable quantity uses its tier. Fractional quantities are retained at the configured rounding increment. Warehouse-origin tariffs always require approval and identify customer handover to the China warehouse separately from EXW pickup and tax treatment.

Optional air handling charges apply per chargeable kilogram. Battery/sensitive and extra-care cargo requires review. Combined special-cargo categories produce a staff quotation instead of assuming supplements can be combined.

AED delivery tables cover seven UAE city zones. The single-box charge is eligible only for air cargo with one package and gross weight strictly below 25 kg. Every other cargo uses actual-volume bands. Package quantity is rechecked when the details are reviewed and when the booking is submitted. Out-of-city, restricted-area and free-zone delivery is quotation-only. Ras Al Khor self-collection is free. Redelivery fees are not calculated because the fee basis requires confirmation.

The Excel template retains its original Rates and Rules columns, appends optional selling/handling/tier/transit/availability columns, and adds a Delivery sheet. Existing version-one templates are accepted; imported legacy records preserve extended properties that were absent from the old template. New downloads carry current rate IDs and versions. Preview and publish remain Super Admin only, atomic, version checked and audited.

Transit and route-wide container availability are publication-time information, not carrier reservations or live inventory. Unknown operational limits and EXW charges remain unquoted. Actual owner prices, the upload file and the private fixture stay outside the public source repository.

Validation covers selling-only entry, exact tier boundaries and fractions, density checks, volumetric air weight, minimums, special cargo, single-box eligibility below versus at 25 kg, delivery zones, currency separation, Excel round trips, and existing authentication/booking/import regression tests. Browser verification uses a disposable local database before the real staff import.
