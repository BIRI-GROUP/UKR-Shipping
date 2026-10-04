-- Shared booking intake, explicit customer contacts, ETA history and retry protection.
-- Existing booking records and agreed prices are retained unchanged.
ALTER TABLE bookings
 ADD COLUMN legal_owner_name TEXT CHECK(legal_owner_name IS NULL OR length(trim(legal_owner_name)) BETWEEN 1 AND 200),
 ADD COLUMN contact_phone TEXT CHECK(contact_phone IS NULL OR length(trim(contact_phone)) BETWEEN 1 AND 40),
 ADD COLUMN contact_email TEXT CHECK(contact_email IS NULL OR (contact_email=lower(contact_email) AND length(contact_email)<=254)),
 ADD COLUMN shipper_name TEXT NOT NULL DEFAULT '' CHECK(length(shipper_name)<=200),
 ADD COLUMN shipper_phone TEXT NOT NULL DEFAULT '' CHECK(length(shipper_phone)<=40),
 ADD COLUMN shipper_email TEXT NOT NULL DEFAULT '' CHECK(shipper_email=lower(shipper_email) AND length(shipper_email)<=254),
 ADD COLUMN warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT,
 ADD COLUMN destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT;
CREATE INDEX bookings_warehouse_id_idx ON bookings(warehouse_id);
CREATE INDEX bookings_destination_warehouse_id_idx ON bookings(destination_warehouse_id);
CREATE INDEX bookings_customer_eta_idx ON bookings(customer_company_id,eta,id) WHERE deleted_at IS NULL;
ALTER TABLE booking_status_events
 ADD COLUMN event_kind TEXT NOT NULL DEFAULT 'status' CHECK(event_kind IN ('status','eta_changed')),
 ADD COLUMN eta TIMESTAMPTZ;
CREATE SEQUENCE ukr_booking_intake_number AS BIGINT START WITH 1 NO CYCLE;
CREATE TABLE booking_submissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 key_hash CHAR(64) NOT NULL CHECK(key_hash ~ '^[a-f0-9]{64}$'),
 payload_hash CHAR(64) NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 UNIQUE(actor_id,key_hash)
);
CREATE INDEX booking_submissions_booking_idx ON booking_submissions(booking_id);
CREATE INDEX booking_submissions_creator_idx ON booking_submissions(created_by);
CREATE INDEX booking_submissions_created_idx ON booking_submissions(created_at);
CREATE FUNCTION ukr_booking_identity_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.code IS DISTINCT FROM OLD.code OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.customer_company_id IS DISTINCT FROM OLD.customer_company_id
    OR NEW.service_id IS DISTINCT FROM OLD.service_id THEN
  RAISE EXCEPTION 'Booking identity cannot be rewritten' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_identity_guard BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION ukr_booking_identity_guard();
