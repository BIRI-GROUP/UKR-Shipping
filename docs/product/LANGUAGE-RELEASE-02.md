# UKR Booking Lab: complete current-site language release 02

## Target and scope

This release is exclusively for https://ukr-booking-lab.onrender.com/.
Render service: `srv-db006v3tqb8s73e1caqg`. Repository: `BIRI-GROUP/UKR-Shipping`.
Working branch: `draft/booking-homepage-2026-10-02`. No merge to main and no older-site deployment.

The current 17 HTML pages and their authored interactions are covered in English, Arabic, Russian, French, Urdu, Hindi and Simplified Chinese, in that order. Coverage includes the homepage, seven service forms, search results, booking detail/review/completion panels, tracking and quotation explanations, validation, accessible labels, contact/service/account information pages, the Knowledge Centre index, all four complete articles, and the multi-package CBM calculator.

The existing selector, explicit URL preference, saved manual language choice and browser-language fallback remain. Arabic and Urdu use RTL. The logo and image assets are not replaced, regenerated or mirrored. New locale styles accommodate text length and writing direction while retaining the existing layout and brand.

## Implementation

- `preview/locales/`: 343 additional seven-column authored translation rows across interface, knowledge, operations and common labels. Existing dictionary entries are reused rather than translated independently a second time.
- `preview/i18n-runtime.js`: reversible authored-node translation, translated attributes, placeholders, validation and dynamic parameters; locale-aware dates, numbers and country names. Customer text, file objects/names, canonical option values, port identifiers, carrier names and the legal company name are protected. No translation service receives customer data.
- `preview/knowledge.js`: localized filtering/search and CBM result messages. Search recognizes translated article text. Numerical handoff values remain canonical and include the chosen language.
- `preview/ports-ui.js`: translated country aliases, group descriptions, counts, spelling suggestions and pagination. Port names and UN/LOCODE identifiers retain the reference source. Country selection and requests do not change with display language.
- `preview/i18n-complete.css`: responsive and RTL adjustments, including the booking drawer and file-selection captions.
- `preview/translation-release.mjs`: runs after the existing build and approved-artwork step. Validates all seven dictionary values and message parameters, scans every generated page for untranslated authored text/attributes, compiles generated scripts, writes `/language-checks.json` and updates `/version.json`. Missing authored copy stops the build.
- `preview/prepare.mjs`: invokes this completion step and requires the release tests before publication. The original CSP continues to prohibit network booking submissions and payments.

Public translation-progress notices and decorative draft/test captions are removed. Actual unavailable functionality is described accurately with contact-UKR instructions. The review completion screen never invents a booking reference or claims a request/email/payment was submitted.

## Verification performed before deployment

- All nine implementation files saved through GitHub were compared with the local tested bytes using Git blob SHA-1 identifiers.
- Existing Node language-policy suite: 16 passed, zero failed.
- New `tests/translation-release.test.mjs`: 18 passed, zero failed locally. The same tests are required by the hosted build.
- In-memory Chromium regression: 1,106 assertions passed, zero assertion failures and zero JavaScript page errors.
- The browser matrix covers all 17 generated pages in all seven languages and page overflow at 375, 390, 768, 1024 and 1440 pixels. It also exercises all seven service modes, canonical equipment/country values, port selection, results, estimate/quotation explanations, customer-entered values deliberately equal to UI phrases, email mismatch, optional VAT, a synthetic selected PDF, review/terms gating, safe completion, tracking explanation, localized Knowledge Centre filtering and calculator handoff.
- Calculator example checked: 2.7 CBM and 105 kg, preserved numerically through every language switch and encoded correctly in the Sea LCL query.

The browser checks load the tested HTML/CSS/JavaScript in memory because network navigation is blocked in the working environment. They use a synthetic port fixture and placeholder artwork with the intended dimensions. They are not a live-browser visit, a linguistic certification, a native storage certification or a test of real bookings/accounts/payments. The production Render build retains the full official port-directory and approved-artwork integrity checks. Deployment must be separately checked for a `live` result before reporting publication.

## Operational boundaries

Translation is complete for the pages and interactions currently built, not an assertion that future dashboard features exist. Account authentication, booking persistence, carrier rates, document uploads, payment processing, quotation PDF generation and tracking integration remain separate backend tasks. No existing customer records, staff accounts, credentials, rates or database data are changed by this release.

Not every official port name has a localized exonym. Those reference names and codes deliberately stay intact; all country selectors and interface explanations are localized. Existing article numbers, formulas and carrier-source links are retained. No new carrier ranking, schedule, price, payment promise or legal policy has been fabricated.

## Repeatable checks

Run the real build with `node preview/prepare.mjs`; the existing 16 language-policy tests and 18 new release tests run as gates. Inspect `/language-checks.json` for the actual generated page list and zero missing values. In a browser, `UKRLanguageCoverage.scan()` reports unknown authored interface strings encountered in the current state. Any later source-content change must supply every language before release.
