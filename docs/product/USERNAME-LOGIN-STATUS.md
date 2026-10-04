# Username demonstration login: verified application change

The requested demonstration credentials are Admin / 1234 at /staff/ and customer / 1234 at /customer/. Neither account authenticates a real staff member or customer. No email or OTP is needed for these two demonstration accounts.

## Implementation

The existing server now calls the isolated demonstration gateway when explicitly enabled on the designated ukr-staff-staging service. The form label and input type are Username/text, the password minimum is four characters only in this demonstration, and the email-delivery status script no longer disables this form. Staff and customer sessions use separate HttpOnly cookies so both tabs can be open at once. Expiry, same-origin, CSRF, fresh role checks and logout remain enforced.

Only the explicitly marked ukr_username_demo_v1 schema is provisioned. Operational records and credentials are not imported or changed. The pages show a prominent test-only disclosure. Account creation, permission mutation, provider setup and outbound email are blocked through shared demonstration sessions. The underlying portal and booking implementation is reused for test bookings and authorised ETA changes. This is not completion of the remaining operational phases.

## Verification before publication

Application commit 5ce2de6e555e05d67e61079db6336afac2e98291. GitHub Actions run 37223273839 completed successfully: existing regressions, real PostgreSQL/unit checks, the existing authenticated Phase 1 browser suite, and the new username browser check all passed. The new check opens both forms in all seven languages and at mobile/desktop widths, signs in as both test accounts, verifies their identities, reloads both sessions and signs out.

Separately, 35 local Node 24.21.0/PostgreSQL 18.6 HTTP assertions passed: login, incorrect credentials, Origin/CSRF, role/cookie isolation, test booking/retry, saved ETA visibility, blocked real-account/provider actions and logout. No operational database was used. Local Chromium navigation was blocked by its administrator policy; that policy was not altered. The successful browser checks ran in the authorised GitHub CI test environment instead.

The earlier blocked tests/demo/login.test.mjs upload was not retried or moved. The accepted existing tests/browser/live-portals.mjs was extended for different browser-level checks.

## Activation and hosted verification

Activate only on service srv-dasko9gjo6nc73c7lodg using UKR_USERNAME_DEMO=true and UKR_DEMO_EXPIRES_AT with an expiry within fifteen days. Other environment values, including NODE_ENV, AUTH_TEST_MODE, database credentials, storage paths and DNS, are preserved. This adds no paid resource.

The same browser script separately checks the actual hosted URL after main publication, first verifying that the isolated demonstration release is active before sending either known test credential. It creates no cargo records on the hosted service. Its hosted result and the Render deployment must be checked before telling the owner that login works online. Disabling the flag restores the existing guarded operational portal. Demonstration records remain separate until explicitly removed.
