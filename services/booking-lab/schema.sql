-- Explicit, additive migration. Not run automatically against an existing service.
-- Apply after services/staff/schema.sql. No existing customer/staff/rate data is rewritten.
CREATE TABLE IF NOT EXISTS booking_lab_companies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS booking_lab_customers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','ar','ru','fr','ur','hi','zh')),
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS booking_lab_memberships (
  customer_id TEXT NOT NULL REFERENCES booking_lab_customers(id),
  company_id TEXT NOT NULL REFERENCES booking_lab_companies(id),
  approved INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  PRIMARY KEY (customer_id,company_id)
);
CREATE TABLE IF NOT EXISTS booking_lab_requests (
  id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL,
  company_id TEXT NOT NULL REFERENCES booking_lab_companies(id),
  customer_id TEXT NOT NULL REFERENCES booking_lab_customers(id),
  service TEXT NOT NULL CHECK (service IN ('sea_fcl','sea_lcl','sea_ddp','air_ddp','air_express','land','customs')),
  origin TEXT NOT NULL, destination TEXT NOT NULL, ready_date TEXT NOT NULL,
  goods TEXT NOT NULL, quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0), unit TEXT NOT NULL,
  equipment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('submitted','under_review','information_required','ready_for_confirmation','cancelled')),
  assignee_id TEXT REFERENCES staff_users(id), internal_note TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  request_key_hash TEXT NOT NULL, payload_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
  UNIQUE (company_id,customer_id,request_key_hash)
);
CREATE INDEX IF NOT EXISTS booking_lab_company_queue ON booking_lab_requests(company_id,status,created_at);
CREATE INDEX IF NOT EXISTS booking_lab_staff_queue ON booking_lab_requests(assignee_id,status,created_at);
CREATE TABLE IF NOT EXISTS booking_lab_events (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES booking_lab_requests(id),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer','staff')),
  actor_id TEXT NOT NULL, action TEXT NOT NULL,
  status TEXT NOT NULL, version INTEGER NOT NULL, created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_lab_event_history ON booking_lab_events(request_id,version);
