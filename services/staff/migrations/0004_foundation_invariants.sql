-- Database invariants; no operational records seeded.
ALTER TABLE email_outbox ADD CONSTRAINT outbox_language_check CHECK(language IN ('en','ar','ru','fr','ur','hi','zh'));
ALTER TABLE users ADD CONSTRAINT user_credential_kind_check CHECK ((kind='staff' AND legacy_customer_id IS NULL) OR (kind='customer' AND staff_user_id IS NULL));
CREATE FUNCTION ukr_booking_rate_lock() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.rate_locked_at IS NOT NULL AND (NEW.agreed_amount IS DISTINCT FROM OLD.agreed_amount OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.agreement_snapshot IS DISTINCT FROM OLD.agreement_snapshot) THEN
  IF NEW.currency IS DISTINCT FROM OLD.currency OR NEW.agreed_amount IS NULL OR NEW.agreed_amount<OLD.agreed_amount OR length(trim(NEW.rate_change_reason))=0 OR NEW.rate_change_reason=OLD.rate_change_reason THEN
   RAISE EXCEPTION 'Locked rate requires an explicit increase reason; currency cannot change' USING ERRCODE='23514';
  END IF;
 END IF;
 IF OLD.rate_locked_at IS NOT NULL AND NEW.rate_locked_at IS DISTINCT FROM OLD.rate_locked_at THEN RAISE EXCEPTION 'Booking rate lock is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_rate_lock BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION ukr_booking_rate_lock();
CREATE FUNCTION ukr_journal_balance_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='posted' THEN RAISE EXCEPTION 'Posted journal is immutable; post a reversal entry' USING ERRCODE='23514'; END IF;
 IF NEW.status='posted' THEN
  IF NOT EXISTS(SELECT 1 FROM journal_lines WHERE journal_entry_id=NEW.id AND deleted_at IS NULL) OR EXISTS(SELECT currency FROM journal_lines WHERE journal_entry_id=NEW.id AND deleted_at IS NULL GROUP BY currency HAVING sum(debit)<>sum(credit)) THEN
   RAISE EXCEPTION 'Journal must balance in each currency' USING ERRCODE='23514';
  END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER journal_balance BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION ukr_journal_balance_guard();
CREATE FUNCTION ukr_posted_lines_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM journal_entries WHERE id=COALESCE(NEW.journal_entry_id,OLD.journal_entry_id) AND status='posted') THEN RAISE EXCEPTION 'Posted journal lines are immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER journal_lines_lock BEFORE INSERT OR UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION ukr_posted_lines_guard();
UPDATE task_rules SET owner_source='event_user' WHERE code IN ('goods-details','quote-followup','status-stale','eta-soon');
UPDATE task_rules SET conditions='[{"field":"ageHours","op":"gte","value":48}]',repeat_minutes=2880 WHERE code='status-stale';
UPDATE task_rules SET conditions='[{"field":"ageHours","op":"gte","value":24}]',owner_source='event_role',repeat_minutes=1440 WHERE code='approval-waiting';
INSERT INTO task_rules(code,trigger_event,title_template,owner_source,owner_role_id,due_minutes,repeat_minutes)
 SELECT 'daily-currency-rate','currency.rate_missing','Update daily currency rate: {code}','event_user',id,0,60 FROM roles WHERE code='currency_rate_user';
