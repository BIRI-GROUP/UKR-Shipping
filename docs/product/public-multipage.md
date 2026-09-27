# UKR public website — September 2026

The public site now has separate Home, Services, Routes, Shipping Tools, News & Updates, Contact, Shipping Estimate and Customer Portal pages. The portal page describes the upcoming account work; it does not simulate authenticated customer data.

`node scripts/build-public.mjs` generates the eight pages in English, Arabic, Simplified Chinese, French, Russian, Urdu and Hindi. Edit the dictionaries and templates in `site/public-v2`, then regenerate the committed HTML. Arabic and Urdu use RTL layouts. Language navigation retains entered shipping details and recalculates offers. Translated city names resolve to the same backend routes.

All website-authored copy, forms, review and receipt states are translated. Free-text tariff inclusions, exclusions and notes remain exactly as staff entered them, with an explicit original-language label on translated pages. Do not silently machine-translate commercial tariff conditions. Localized tariff content management and customer account workflows remain separate follow-up work.

The existing public API remains authoritative for prices, cargo approval, rate versions and submission idempotency. Drafts are saved on the device only when requested. The new UI retains manual enquiries, priced requests, special-cargo re-estimation, request receipts and the landed-cost planning tool. This update does not publish the sample Excel prices or invent inventory.

On staff startup, an atomic, one-time migration adds the nine approved China-to-Jebel-Ali routes. It preserves all existing route records and subsequent staff edits and creates no tariffs. Airports and specific gateways remain subject to confirmation. Other country connections are displayed as enquiries, not guaranteed direct routes.

Validation: 35 existing and new automated tests passed; static generation and internal links checked for all 56 pages. Browser checks cover all seven homepages at desktop and phone widths, Arabic RTL subpages, mobile navigation, translated city matching, draft saving, language preservation and a complete request submission against an isolated local test database. No test bookings were submitted to the live service.
