# UKR language foundation 01

## Implemented in the existing draft branch
The shared registry is ordered English (EN), Arabic (AR), Russian (RU), French (FR), Urdu (UR), Hindi (HI), Simplified Chinese (ZH). Each entry carries its native name, decorative flag, language tag and writing direction. Arabic and Urdu use RTL; brand artwork is never mirrored.

The header selector supports mouse, touch and keyboard, including arrow keys, Home, End and Escape. Locale resolution uses an explicit language URL first, then a saved manual choice, then the first supported browser preference, then English. Regional browser tags are normalized. Only a manually selected language code is stored. Storage failures are handled, and internal page links carry the selected locale. Preferences are origin-scoped; authenticated cross-domain profile preferences are future work.

## Integration
- `site/i18n/`: one reusable registry, selector, styles and build helper.
- `scripts/build-public.mjs`: adds the shared selector to all generated public language pages, while retaining the existing translated templates and form-state handoff. This updates the generator; previously committed generated HTML is not rewritten by this commit alone.
- `preview/language-build.mjs`: adds language assets to every HTML page produced by the isolated preview build, including nested Knowledge Centre pages and coming-soon pages. It reuses the existing public dictionaries.
- `preview/language-copy.mjs`: 81 additional keyed working translations, each supplied in all seven languages, for navigation, service cards, cargo/customer fields, booking labels and coming-soon content.
- `preview/language-ui.js`: scoped migration adapter for known authored UI regions. New components should use explicit `data-i18n` keys rather than depend on English-text matching.
- `preview/finalize4.mjs`: retains the existing port/build checks, runs the locale tests, then integrates language assets and compiles the generated JavaScript.

The preview changes language in place. Selected ports, canonical option values, container quantities, typed customer details and selected files are not re-created or persisted by the language system. A native language control is also provided inside the booking drawer because a modal makes the outer header inert. User-entered review values, cargo details, references and documents are excluded from translation. No translation API receives customer data.

## Translation completion is deliberately not claimed
This is a foundation and initial UI translation pass, not a fully translated release. Some homepage prose, knowledge articles, service-specific notes, validation messages and commercial copy remain in their source language. Non-English preview selections display a translated notice explaining that some content is still English.

`UKRLanguageCoverage.untranslatedUI()` reports unmatched copy encountered in the scoped UI adapter. This is a migration aid, not a complete page-content audit. The generated `language-checks.json` lists integrated pages and missing dictionary keys. Zero missing dictionary keys does not mean every page or commercial condition has been translated. Full text review and glossary/terms approval remain release gates.

## Tests actually run
- 16 Node automated tests passed: order, direction, browser-tag normalization, explicit-language precedence, saved choice, fallback, blocked storage, URL/query/hash preservation, idempotent page injection and all seven columns for the 81 new entries.
- 40 in-memory Chromium checks passed using the existing offline prototype and a sample nested page. Checks covered menu navigation, Arabic and Urdu, service/search labels, port/equipment preservation, booking fields and a synthetic selected file, protection of customer text equal to UI phrases, review/terms gating and page overflow at 375, 768 and 1440 pixels for all seven languages.
- Browser network navigation is blocked in the working environment. The browser harness used a storage test double. These results are not a live revision-04 end-to-end check, a native-browser persistence certification, or linguistic/commercial approval.
- The full existing public-page build and the hosted preview deployment have not been verified in this session. Existing customer/staff applications and backend services were not changed.

Run the committed policy tests with `node --test tests/languages.test.mjs`. For public-page regeneration, use `node scripts/build-public.mjs` and review generated differences before publishing. The isolated preview receives its language step through the existing finalizer; it is not promoted into the production homepage.

## Preserved boundaries
No merge to main, production rollout, new image, logo replacement, base artwork edit, rate change, real booking submission, upload, payment, tracking request or quotation-PDF activation was performed as part of this work. Preview deployment success is not asserted here.

## References used for implementation
- https://www.w3.org/International/quicktips/Overview
- https://www.w3.org/International/questions/qa-html-dir
- https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
