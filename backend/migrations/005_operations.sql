CREATE FUNCTION app.set_inventory(p_facility uuid,p_capacity integer,p_price integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE count_active integer; floor uuid; entry record; rate integer; ordinal integer;
BEGIN
  IF NOT app.can_manage(p_facility) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Facility management access is required.'; END IF;
  IF p_capacity NOT BETWEEN 0 AND 500 OR p_price NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION '400|INVALID_INVENTORY|Use 0–500 spaces and a valid KZT rate.'; END IF;
  PERFORM 1 FROM app.facilities WHERE id=p_facility FOR UPDATE;
  FOR entry IN SELECT id FROM app.spaces WHERE facility_id=p_facility ORDER BY id FOR UPDATE LOOP
    PERFORM app.expire_space(entry.id);
  END LOOP;
  SELECT count(*) INTO count_active FROM app.spaces WHERE facility_id=p_facility AND active;
  IF p_capacity<count_active THEN
    FOR entry IN SELECT id FROM app.spaces WHERE facility_id=p_facility AND active ORDER BY label DESC LIMIT(count_active-p_capacity) LOOP
      IF EXISTS(SELECT 1 FROM app.space_allocations WHERE space_id=entry.id AND released_at IS NULL AND ends_at>clock_timestamp())
        OR EXISTS(SELECT 1 FROM app.parking_sessions x JOIN app.reservations r ON r.id=x.reservation_id JOIN app.space_allocations a ON a.id=r.allocation_id WHERE a.space_id=entry.id AND x.state='active') THEN
        RAISE EXCEPTION '409|INVENTORY_IN_USE|A space being removed has a reservation, hold, block or active session.';
      END IF;
      UPDATE app.spaces SET active=false WHERE id=entry.id;
    END LOOP;
  ELSIF p_capacity>count_active THEN
    SELECT id INTO floor FROM app.floors WHERE facility_id=p_facility ORDER BY name LIMIT 1;
    IF floor IS NULL THEN INSERT INTO app.floors(facility_id,name) VALUES(p_facility,'Ground') RETURNING id INTO floor; END IF;
    FOR entry IN SELECT id FROM app.spaces WHERE facility_id=p_facility AND NOT active ORDER BY label LIMIT(p_capacity-count_active) LOOP
      UPDATE app.spaces SET active=true WHERE id=entry.id; count_active:=count_active+1;
    END LOOP;
    SELECT count(*) INTO ordinal FROM app.spaces WHERE facility_id=p_facility;
    WHILE count_active<p_capacity LOOP
      ordinal:=ordinal+1;
      INSERT INTO app.spaces(facility_id,floor_id,label) VALUES(p_facility,floor,'S-'||lpad(ordinal::text,4,'0'));
      count_active:=count_active+1;
    END LOOP;
  END IF;
  SELECT hourly_kzt INTO rate FROM app.pricing_rules WHERE facility_id=p_facility AND active;
  IF rate IS DISTINCT FROM p_price THEN
    UPDATE app.pricing_rules SET active=false WHERE facility_id=p_facility AND active;
    INSERT INTO app.pricing_rules(facility_id,version,hourly_kzt)
      SELECT p_facility,coalesce(max(version),0)+1,p_price FROM app.pricing_rules WHERE facility_id=p_facility;
  END IF;
  RETURN jsonb_build_object('ok',true,'capacity',p_capacity,'price',p_price);
END $$;
CREATE FUNCTION app.add_floor(p_facility uuid,p_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE identity uuid;
BEGIN
  IF NOT app.can_manage(p_facility) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Facility management access is required.'; END IF;
  INSERT INTO app.floors(facility_id,name) VALUES(p_facility,p_name) RETURNING id INTO identity; RETURN identity;
END $$;
CREATE FUNCTION app.add_space(p_facility uuid,p_floor uuid,p_label text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE identity uuid;
BEGIN
  IF NOT app.can_manage(p_facility) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Facility management access is required.'; END IF;
  PERFORM 1 FROM app.facilities WHERE id=p_facility FOR UPDATE;
  IF (SELECT count(*) FROM app.spaces WHERE facility_id=p_facility AND active)>=500 THEN RAISE EXCEPTION '400|INVENTORY_LIMIT|This facility has reached its space limit.'; END IF;
  INSERT INTO app.spaces(facility_id,floor_id,label) VALUES(p_facility,p_floor,p_label) RETURNING id INTO identity; RETURN identity;
END $$;
CREATE FUNCTION app.block_space(p_space uuid,p_start timestamptz,p_end timestamptz,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE space app.spaces; claim uuid; identity uuid;
BEGIN
  SELECT * INTO space FROM app.spaces WHERE id=p_space;
  IF NOT FOUND OR NOT app.can_manage(space.facility_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Facility management access is required.'; END IF;
  PERFORM 1 FROM app.spaces WHERE id=p_space FOR UPDATE; PERFORM app.expire_space(p_space);
  IF p_end<=p_start OR p_end-p_start>interval '90 days' THEN RAISE EXCEPTION '400|INVALID_WINDOW|Invalid maintenance window.'; END IF;
  INSERT INTO app.space_allocations(space_id,facility_id,kind,starts_at,ends_at) VALUES(p_space,space.facility_id,'maintenance',p_start,p_end) RETURNING id INTO claim;
  INSERT INTO app.maintenance_blocks(allocation_id,facility_id,reason,created_by) VALUES(claim,space.facility_id,p_reason,app.uid()) RETURNING id INTO identity;
  RETURN identity;
END $$;
CREATE FUNCTION app.release_block(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE block record;
BEGIN
  SELECT b.*,a.space_id INTO block FROM app.maintenance_blocks b JOIN app.space_allocations a ON a.id=b.allocation_id WHERE b.id=p_id;
  IF NOT FOUND OR NOT app.can_manage(block.facility_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Facility management access is required.'; END IF;
  PERFORM 1 FROM app.spaces WHERE id=block.space_id FOR UPDATE;
  UPDATE app.space_allocations SET released_at=coalesce(released_at,clock_timestamp()) WHERE id=block.allocation_id;
  INSERT INTO app.audit_logs(actor_id,action,target_id,facility_id) VALUES(app.uid(),'maintenance.released',p_id::text,block.facility_id);
END $$;
CREATE FUNCTION app.record_session(p_reservation uuid,p_checkout boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE reservation record; session app.parking_sessions;
BEGIN
  SELECT r.*,a.space_id,a.starts_at,a.ends_at INTO reservation FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id WHERE r.id=p_reservation;
  IF NOT FOUND OR NOT app.can_manage(reservation.facility_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|The assigned operator must record entry and exit.'; END IF;
  PERFORM 1 FROM app.spaces WHERE id=reservation.space_id FOR UPDATE;
  SELECT * INTO session FROM app.parking_sessions WHERE reservation_id=p_reservation FOR UPDATE;
  IF p_checkout THEN
    IF session.id IS NULL THEN RAISE EXCEPTION '409|NO_SESSION|There is no checked-in session.'; END IF;
    IF session.state='active' THEN
      UPDATE app.parking_sessions SET state='ended',checked_out_at=clock_timestamp() WHERE id=session.id;
      UPDATE app.reservations SET status='completed' WHERE id=p_reservation AND status='confirmed';
      UPDATE app.space_allocations SET released_at=clock_timestamp() WHERE id=reservation.allocation_id;
    END IF;
  ELSE
    IF session.id IS NOT NULL THEN RETURN jsonb_build_object('id',session.id,'state',session.state,'replayed',true); END IF;
    IF reservation.status<>'confirmed' OR clock_timestamp()<reservation.starts_at OR clock_timestamp()>=reservation.ends_at THEN
      RAISE EXCEPTION '409|CHECKIN_CLOSED|Check-in is allowed only during a confirmed reservation.';
    END IF;
    INSERT INTO app.parking_sessions(reservation_id,user_id,facility_id,state)
      VALUES(p_reservation,reservation.user_id,reservation.facility_id,'active') RETURNING * INTO session;
  END IF;
  RETURN (SELECT jsonb_build_object('id',id,'state',state,'source',source) FROM app.parking_sessions WHERE id=session.id);
END $$;
CREATE FUNCTION app.admin_user(p_user uuid,p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF NOT app.has_role('admin') THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Administrator access is required.'; END IF;
  IF p_user=app.uid() AND NOT p_active THEN RAISE EXCEPTION '409|SELF_DISABLE|You cannot disable your own account.'; END IF;
  UPDATE app.profiles SET active=p_active WHERE id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|User not found.'; END IF;
  IF NOT p_active THEN UPDATE auth.sessions SET revoked_at=clock_timestamp() WHERE user_id=p_user AND revoked_at IS NULL; END IF;
END $$;
CREATE FUNCTION app.admin_role(p_user uuid,p_role text,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF NOT app.has_role('admin') THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Administrator access is required.'; END IF;
  IF p_role NOT IN ('driver','operator','admin') THEN RAISE EXCEPTION '400|INVALID_ROLE|Unknown role.'; END IF;
  PERFORM pg_advisory_xact_lock(702819);
  IF p_role='admin' AND NOT p_enabled AND (p_user=app.uid() OR (SELECT count(*) FROM app.user_roles r JOIN app.profiles p ON p.id=r.user_id WHERE r.role='admin' AND p.active)<=1) THEN
    RAISE EXCEPTION '409|ADMIN_PROTECTION|The current or last administrator cannot be removed.';
  END IF;
  IF p_enabled THEN INSERT INTO app.user_roles(user_id,role) VALUES(p_user,p_role) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM app.user_roles WHERE user_id=p_user AND role=p_role; END IF;
END $$;
CREATE FUNCTION app.admin_operator(p_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE identity uuid;
BEGIN
  IF NOT app.has_role('admin') THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Administrator access is required.'; END IF;
  INSERT INTO app.operators(name) VALUES(p_name) RETURNING id INTO identity; RETURN identity;
END $$;
CREATE FUNCTION app.admin_membership(p_operator uuid,p_user uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF NOT app.has_role('admin') THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Administrator access is required.'; END IF;
  INSERT INTO app.operator_memberships(operator_id,user_id,active) VALUES(p_operator,p_user,p_enabled)
    ON CONFLICT(operator_id,user_id) DO UPDATE SET active=excluded.active;
  IF p_enabled THEN INSERT INTO app.user_roles(user_id,role) VALUES(p_user,'operator') ON CONFLICT DO NOTHING; END IF;
END $$;
CREATE FUNCTION app.create_facility(p_operator uuid,p_name text,p_area text,p_address text,p_lat numeric,p_lng numeric,p_type text,p_price integer,p_capacity integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE identity uuid;
BEGIN
  IF NOT app.is_member(p_operator) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Organization access is required.'; END IF;
  INSERT INTO app.facilities(operator_id,name,area,address,lat,lng,type) VALUES(p_operator,p_name,p_area,p_address,p_lat,p_lng,p_type) RETURNING id INTO identity;
  PERFORM app.set_inventory(identity,p_capacity,p_price); RETURN identity;
END $$;
CREATE FUNCTION app.admin_approval(p_facility uuid,p_approved boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF NOT app.has_role('admin') THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Administrator access is required.'; END IF;
  UPDATE app.facilities SET approved=p_approved WHERE id=p_facility;
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Facility not found.'; END IF;
END $$;

-- Default PUBLIC function execution would expose security-definer helpers.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app,auth FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.uid(),app.has_role(text),app.is_member(uuid),app.can_manage(uuid),app.visible_facility(uuid) TO parkly_app;
GRANT EXECUTE ON FUNCTION auth.register_account(text,text,text),auth.credentials(text),auth.open_session(uuid,text),auth.session_user(text),auth.close_session(text),auth.consume_limit(text,integer,integer) TO parkly_app;
GRANT EXECUTE ON FUNCTION app.expire_due(),app.available_spaces(uuid,timestamptz,timestamptz),app.hold_space(uuid,timestamptz,timestamptz,integer,uuid),app.confirm_hold(uuid),app.release_hold(uuid),app.cancel_reservation(uuid,uuid),app.extend_reservation(uuid,timestamptz,uuid) TO parkly_app;
GRANT EXECUTE ON FUNCTION app.set_inventory(uuid,integer,integer),app.add_floor(uuid,text),app.add_space(uuid,uuid,text),app.block_space(uuid,timestamptz,timestamptz,text),app.release_block(uuid),app.record_session(uuid,boolean),app.admin_user(uuid,boolean),app.admin_role(uuid,text,boolean),app.admin_operator(text),app.admin_membership(uuid,uuid,boolean),app.create_facility(uuid,text,text,text,numeric,numeric,text,integer,integer),app.admin_approval(uuid,boolean) TO parkly_app;
