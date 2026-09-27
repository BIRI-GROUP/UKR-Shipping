CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES staff_users(id),
  csrf TEXT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_invites (
  token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES staff_users(id), expires_at BIGINT NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES staff_users(id),
  created_by TEXT NOT NULL REFERENCES staff_users(id),
  expires_at BIGINT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff_work (
  id TEXT PRIMARY KEY, module TEXT NOT NULL, title TEXT NOT NULL,
  reference TEXT NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL,
  assignee_id TEXT NOT NULL REFERENCES staff_users(id), created_by TEXT NOT NULL REFERENCES staff_users(id),
  version INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_audit (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
  detail TEXT NOT NULL, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_limits (
  key TEXT PRIMARY KEY, hits INTEGER NOT NULL, window_end BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_sessions_user ON staff_sessions(user_id);
CREATE INDEX IF NOT EXISTS staff_work_scope ON staff_work(module, assignee_id);
CREATE INDEX IF NOT EXISTS staff_audit_time ON staff_audit(created_at);
CREATE TABLE IF NOT EXISTS freight_rates (
  id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1,
  origin_key TEXT NOT NULL, destination_key TEXT NOT NULL, product TEXT NOT NULL,
  valid_from TEXT NOT NULL, valid_to TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL, updated_by TEXT NOT NULL REFERENCES staff_users(id), updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS freight_rates_route ON freight_rates(origin_key,destination_key,product,published);
CREATE TABLE IF NOT EXISTS website_bookings (
  id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, request_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
  data TEXT NOT NULL, estimate TEXT NOT NULL, status TEXT NOT NULL, shipment_ref TEXT NOT NULL DEFAULT '',
  response_due BIGINT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS ukr_sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
