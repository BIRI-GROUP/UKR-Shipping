# Portal access release

Target: existing ukr-staff-staging Render service. User explicitly requested publication and verification after approving the server/disk upgrade. DNS and both public website source trees remain unchanged. This is a narrowly scoped runtime release, not a claim that all phases are complete.

The previously tested Phase 1 and booking-intake source is promoted into the running service branch. The existing server implementation is preserved byte-for-byte as legacy-server.mjs and re-exported for existing tests and callers. A gateway publishes the actual staff and customer application pages at /staff/ and /customer/, with their seven-language assets. It does not seed users, change existing passwords or migrate operational SQL.

Runtime checks log only presence/readiness flags for the actual persistent mount, schema and email configuration. Secrets and connection strings are not logged. The public status endpoint exposes only the release and sign-in availability. Until the actual schema, disk and production mail sender are ready, portal APIs fail closed and the login page explains unavailable email delivery. An email-success screen, test OTP or authenticated dashboard must never be claimed from publication alone. The existing staff application remains available.

Local Node 24.21.0 tests: 60 legacy regressions and 100 unit/real-PostgreSQL checks passed. PostgreSQL was 18.6 in an isolated local database. These include 13 new gateway tests. Hosted CI repeats these tests and authenticated Phase 1 browser tests. After main publication it separately opens the actual Render /staff/ and /customer/ URLs in Chromium in all seven languages, checks mobile/desktop widths and unauthenticated access, and saves browser evidence. Read-only live-page checks do not prove production OTP delivery or customer access.

No operational migration, real email or extra paid resource is performed by this gateway release. Full portal activation still requires verified private storage, keys, backup/migration work and SMTP delivery. The uncompleted operational Phase 2 workflows are not represented as finished.
