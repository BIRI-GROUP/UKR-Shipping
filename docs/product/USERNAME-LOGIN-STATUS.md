# Username login change: delivery status

The owner requested username/password entry: Admin / 1234 for staff and customer / 1234 for customer testing, replacing email and OTP during review.

Successfully saved on fix/username-demo-login-2026-10-04:
- services/staff/demo/store.mjs: additive, explicitly marked demonstration schema with no operational records imported.
- services/staff/demo/gateway.mjs: expiring designated-staging-only demo access, separate staff/customer session cookies, CSRF and role checks, and no operational authentication changes.
- apps/shared/portal-demo.js: username fields, password-only entry, seven-language notices, and shared test booking/ETA screens.
- tests/demo/harness.mjs: disposable database and HTTP harness.

This code is NOT deployed and is NOT a completed release. The running main server has not been changed to activate these files, and no Render environment changes were applied in this attempt.

The GitHub tool blocked the tests/demo/login.test.mjs upload. A substantive safer revision removed all writes to the public schema and retained read-only public-schema checks, but that upload was also blocked. No further attempt, alternate write method, renamed test file, or deployment is used to bypass the block.

JavaScript syntax checks of the locally prepared new modules succeeded under Node 22.16.0. That is not the required Node 24/PostgreSQL/browser verification. No passing live-login test is claimed. Complete tests and a reviewed, verified deployment remain required before claiming either login works.

The shared demo credentials must never authenticate real customers or grant access to existing operational staff records. Production login, real staff passwords, public website, DNS, database network access and paid hosting are unchanged.
