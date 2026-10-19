-- UKR 360 customer access is opt-in, independent of company approval.
-- No existing company gains access from this migration.
ALTER TABLE customer_companies
  ADD COLUMN portal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN portal_enabled_at TIMESTAMPTZ,
  ADD COLUMN portal_enabled_by UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX customer_companies_portal_access_idx
  ON customer_companies (id)
  WHERE portal_enabled = TRUE AND deleted_at IS NULL;
