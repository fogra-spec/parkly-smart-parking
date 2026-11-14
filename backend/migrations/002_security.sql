CREATE FUNCTION app.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('parkly.user_id',true),'')::uuid
$$;
CREATE FUNCTION app.has_role(wanted text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM app.user_roles r JOIN app.profiles p ON p.id=r.user_id
    WHERE r.user_id=app.uid() AND r.role=wanted AND p.active)
$$;
CREATE FUNCTION app.is_member(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT app.has_role('admin') OR (app.has_role('operator') AND EXISTS(
    SELECT 1 FROM app.operator_memberships m JOIN app.operators o ON o.id=m.operator_id
    WHERE m.operator_id=org AND m.user_id=app.uid() AND m.active AND o.active))
$$;
CREATE FUNCTION app.can_manage(facility uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM app.facilities f WHERE f.id=facility AND app.is_member(f.operator_id))
$$;
CREATE FUNCTION app.visible_facility(facility uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM app.facilities f WHERE f.id=facility AND (f.approved OR app.is_member(f.operator_id)))
$$;

ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read ON app.profiles FOR SELECT TO parkly_app USING(id=app.uid() OR app.has_role('admin'));
CREATE POLICY profiles_edit ON app.profiles FOR UPDATE TO parkly_app USING(id=app.uid() AND active) WITH CHECK(id=app.uid() AND active);
ALTER TABLE app.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_read ON app.user_roles FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.has_role('admin'));
ALTER TABLE app.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY operators_read ON app.operators FOR SELECT TO parkly_app USING(app.is_member(id));
ALTER TABLE app.operator_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_read ON app.operator_memberships FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.has_role('admin'));
ALTER TABLE app.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY facilities_read ON app.facilities FOR SELECT TO parkly_app USING(approved OR app.is_member(operator_id));
ALTER TABLE app.floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY floors_read ON app.floors FOR SELECT TO parkly_app USING(app.visible_facility(facility_id));
ALTER TABLE app.spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY spaces_read ON app.spaces FOR SELECT TO parkly_app USING(app.visible_facility(facility_id));
ALTER TABLE app.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY prices_read ON app.pricing_rules FOR SELECT TO parkly_app USING(app.visible_facility(facility_id));
ALTER TABLE app.space_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocations_read ON app.space_allocations FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.can_manage(facility_id));
ALTER TABLE app.holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY holds_read ON app.holds FOR SELECT TO parkly_app USING(user_id=app.uid());
ALTER TABLE app.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservations_read ON app.reservations FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.can_manage(facility_id));
ALTER TABLE app.maintenance_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocks_read ON app.maintenance_blocks FOR SELECT TO parkly_app USING(app.can_manage(facility_id));
ALTER TABLE app.reservation_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY extensions_read ON app.reservation_extensions FOR SELECT TO parkly_app USING(EXISTS(SELECT 1 FROM app.reservations r WHERE r.id=reservation_id));
ALTER TABLE app.parking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY parking_sessions_read ON app.parking_sessions FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.can_manage(facility_id));
ALTER TABLE app.booking_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_read ON app.booking_status_history FOR SELECT TO parkly_app USING(
  EXISTS(SELECT 1 FROM app.reservations r WHERE r.id=reservation_id) OR EXISTS(SELECT 1 FROM app.holds h WHERE h.id=hold_id));
ALTER TABLE app.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY preferences_own ON app.notification_preferences TO parkly_app USING(user_id=app.uid()) WITH CHECK(user_id=app.uid());
ALTER TABLE app.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_own ON app.push_subscriptions TO parkly_app USING(user_id=app.uid()) WITH CHECK(user_id=app.uid());
ALTER TABLE app.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY deliveries_own ON app.notification_deliveries FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.has_role('admin'));
ALTER TABLE app.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON app.audit_logs FOR SELECT TO parkly_app USING(actor_id=app.uid() OR app.has_role('admin') OR app.can_manage(facility_id));
ALTER TABLE app.action_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY requests_read ON app.action_requests FOR SELECT TO parkly_app USING(user_id=app.uid());
ALTER TABLE app.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favorites_own ON app.favorites TO parkly_app USING(user_id=app.uid()) WITH CHECK(user_id=app.uid());

-- The API role owns no tables, cannot bypass RLS and has no direct booking,
-- inventory, role or audit write grant. Those operations use checked functions.
GRANT SELECT ON ALL TABLES IN SCHEMA app TO parkly_app;
GRANT UPDATE(name) ON app.profiles TO parkly_app;
GRANT INSERT,UPDATE,DELETE ON app.notification_preferences,app.push_subscriptions,app.favorites TO parkly_app;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM parkly_app, PUBLIC;

CREATE FUNCTION app.log_record_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE row_data jsonb; target text; facility uuid;
BEGIN
  row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  target:=coalesce(row_data->>'id',row_data->>'user_id','system');
  facility:=nullif(row_data->>'facility_id','')::uuid;
  IF TG_TABLE_NAME='facilities' THEN facility:=(row_data->>'id')::uuid; END IF;
  INSERT INTO app.audit_logs(actor_id,action,target_id,facility_id)
    VALUES(app.uid(),TG_TABLE_NAME||'.'||lower(TG_OP),target,facility);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['profiles','user_roles','operators','operator_memberships','facilities','floors','spaces','pricing_rules','maintenance_blocks','parking_sessions','notification_preferences','push_subscriptions'] LOOP
    EXECUTE format('CREATE TRIGGER record_audit AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.log_record_change()',tab);
  END LOOP;
END $$;
CREATE FUNCTION app.log_booking_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE previous text; current_state text; field text;
BEGIN
  field:=CASE WHEN TG_TABLE_NAME='holds' THEN 'state' ELSE 'status' END;
  previous:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD)->>field ELSE NULL END;
  current_state:=to_jsonb(NEW)->>field;
  IF previous IS NOT DISTINCT FROM current_state THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='holds' THEN
    INSERT INTO app.booking_status_history(hold_id,from_status,to_status,actor_id) VALUES(NEW.id,previous,current_state,app.uid());
  ELSE
    INSERT INTO app.booking_status_history(reservation_id,from_status,to_status,actor_id) VALUES(NEW.id,previous,current_state,app.uid());
    INSERT INTO app.notification_deliveries(user_id,reservation_id,event,channel,status)
      SELECT NEW.user_id,NEW.id,'reservation.'||current_state,'in_app','recorded'
      WHERE coalesce((SELECT in_app FROM app.notification_preferences WHERE user_id=NEW.user_id),true);
    INSERT INTO app.notification_deliveries(user_id,reservation_id,event,channel,status)
      SELECT NEW.user_id,NEW.id,'reservation.'||current_state,'push','not_configured'
      WHERE coalesce((SELECT push FROM app.notification_preferences WHERE user_id=NEW.user_id),false);
  END IF;
  INSERT INTO app.audit_logs(actor_id,action,target_id)
    VALUES(app.uid(),TG_TABLE_NAME||'.'||current_state,NEW.id::text);
  RETURN NEW;
END $$;
CREATE TRIGGER hold_history AFTER INSERT OR UPDATE OF state ON app.holds FOR EACH ROW EXECUTE FUNCTION app.log_booking_status();
CREATE TRIGGER reservation_history AFTER INSERT OR UPDATE OF status ON app.reservations FOR EACH ROW EXECUTE FUNCTION app.log_booking_status();

CREATE FUNCTION app.protect_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id<>OLD.user_id OR NEW.facility_id<>OLD.facility_id OR NEW.hold_id<>OLD.hold_id
    OR NEW.allocation_id<>OLD.allocation_id OR NEW.hourly_kzt<>OLD.hourly_kzt
    OR NEW.original_total_kzt<>OLD.original_total_kzt THEN
    RAISE EXCEPTION '409|IMMUTABLE_AGREEMENT|Original reservation terms cannot change.';
  END IF;
  IF OLD.status<>'confirmed' AND NEW.status<>OLD.status THEN
    RAISE EXCEPTION '409|INVALID_STATUS|Terminal reservation status cannot change.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reservation_guard BEFORE UPDATE ON app.reservations FOR EACH ROW EXECUTE FUNCTION app.protect_reservation();
