-- audit_events immutability triggers
-- Deny UPDATE on audit_events
CREATE OR REPLACE FUNCTION audit_events_deny_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events: UPDATE is denied — immutable audit trail';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_deny_update_trigger
BEFORE UPDATE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION audit_events_deny_update();

-- Deny DELETE on audit_events
CREATE OR REPLACE FUNCTION audit_events_deny_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events: DELETE is denied — immutable audit trail';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_deny_delete_trigger
BEFORE DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION audit_events_deny_delete();

-- Document retention policy
COMMENT ON TABLE audit_events IS 'Immutable audit trail. Retention: 3 years minimum. UPDATE and DELETE denied by triggers.';
