# Render activation checkpoint: 4 October 2026

## Actual Render changes

Owner approved the existing UKR staff compute upgrade and a 5 GB disk, with DNS later.
The service is `ukr-staff-staging` (`srv-dasko9gjo6nc73c7lodg`) in the existing confirmed UKR workspace and Frankfurt region.

Only these two environment values were applied through Render's merge operation:

- `PORTAL_FILES_PATH=/var/data/ukr/files`
- `PORTAL_BACKUP_PATH=/var/data/ukr/backups`

All other environment values, including existing credentials, were preserved. No secrets were read or rotated.
Render automatically redeployed the currently configured source, main commit `3879f2e84bdca9f708f403a03669b3807903faf4`.
Deployment `dep-db17o1bncjis73bioa30` was checked and is live. This is the old staff application with the two new path settings, NOT the new portal deployment.
A subsequent service read still reports the Free compute plan. The approved paid compute upgrade and disk attachment have NOT been applied by this session.

## Connector limitation and precise dashboard action

The available Render connection supports environment updates and deploys, but not changes to an existing compute plan, disk attachment, branch or start command. Other available plugins were checked; no additional authorised Render settings action was found.
Use the existing service's Render Dashboard, not a new service or workspace:

1. Compute: select the previously approved `0.5c-512mb` / Starter instance.
2. Disk: attach 5 GB at `/var/data/ukr`.

This does not require DNS changes. Do not switch the application branch or start command before the new portal's remaining activation prerequisites are addressed. No duplicate paid service or database has been created.

## Code delivered on the current Phase 2 branch

Application/test commit: `4ffd4841143494783b04c0de36f55bbd22ac19df`.

- `services/staff/phase1/deployment-check.mjs`: read-only configuration, filesystem mount, complete SQL migration and backup-state checks. Reports missing OTP dispatch accurately; no environment toggle is mistaken for an implemented sender. Output excludes configuration secrets and database connection values. The checker never applies migrations, sends emails or creates infrastructure.
- `services/staff/phase1/db.mjs`: startup now verifies every shipped migration and its SHA-256 checksum, including Phase 2 intake migration 0005. Merely having Phase 1 migration 0004 is insufficient. No existing migration SQL was edited and no new database migration is required for this code change.
- `services/staff/phase1/start.mjs`: production startup requires a real writable runtime disk at the agreed mount, not a directory on ephemeral storage. Initialization closes the database pool on failure. Local test/development behavior is unchanged.
- `tests/phase1/deployment-check.test.mjs`: 14 tests covering mode, secrets, path containment, mount type, symlinks, permissions, complete schema checks and startup ordering.
- `tests/phase1/deployment-postgres.test.mjs`: disposable PostgreSQL tests for complete migration verification, missing migration, checksum mismatch, read-only inspection and no false backup-success report.

Run the read-only diagnostic from the checked-out portal source on its intended runtime with:

```
node services/staff/phase1/deployment-check.mjs
```

A nonzero result identifies unmet prerequisites; it is not permission to bypass them.

## Verification

The 14 isolated unit tests passed locally on Node 22.16.0 as an initial check only. The repository requires Node 24 for delivery.
GitHub Actions run `37216529996` uses Node 24 and a PostgreSQL 18 container. Its existing-regression, portal PostgreSQL/unit and authenticated portal-browser steps were separately checked and each passed on application commit `4ffd484`.
GitHub Actions run `37216529968` completed successfully on the same application commit; its Phase 2 SQL/workflow test step passed. Its new Phase 2 browser journey remains absent and was skipped. The existing Phase 1 browser checks are not an end-to-end test of unfinished Phase 2 screens.
Disk checks use controlled filesystem fixtures; they have NOT verified a real newly attached Render disk. The operational database was not migrated or written. No real email delivery or backup restore was tested here.

## Still required for operational launch

The paid service/disk dashboard changes; secure persistent portal/backup keys; reviewed backup and restore; the authorised SMTP sender and actual OTP delivery; explicit operational migrations; remaining booking screens and Phase 2 workflows; then a verified new-portal deployment. Setting directory names alone does not create a disk, enable daily backups or make shipment operations live.

The Booking Lab website, existing logo/photos, main branch, DNS, production customer records and unrelated BIRI services are unchanged. No claim of Phase 2 or all-phase completion is made.

## Provider references checked

https://render.com/docs/mcp-server
https://render.com/docs/compute-plans
https://render.com/docs/disks
