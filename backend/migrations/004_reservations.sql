CREATE FUNCTION app.expire_space(p_space uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE entry record;
BEGIN
  PERFORM 1 FROM app.spaces WHERE id=p_space FOR UPDATE;
  FOR entry IN SELECT h.id,h.allocation_id FROM app.holds h JOIN app.space_allocations a ON a.id=h.allocation_id
    WHERE a.space_id=p_space AND h.state='held' AND h.expires_at<=clock_timestamp() FOR UPDATE OF h LOOP
    UPDATE app.holds SET state='expired' WHERE id=entry.id;
    UPDATE app.space_allocations SET released_at=clock_timestamp() WHERE id=entry.allocation_id;
  END LOOP;
  FOR entry IN SELECT r.id,r.allocation_id FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id
    WHERE a.space_id=p_space AND r.status='confirmed' AND a.ends_at<=clock_timestamp()
      AND NOT EXISTS(SELECT 1 FROM app.parking_sessions s WHERE s.reservation_id=r.id AND s.state='active')
    FOR UPDATE OF r LOOP
    UPDATE app.reservations SET status='expired' WHERE id=entry.id;
    UPDATE app.space_allocations SET released_at=clock_timestamp() WHERE id=entry.allocation_id;
  END LOOP;
END $$;
CREATE FUNCTION app.expire_due() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE entry record; n integer:=0;
BEGIN
  FOR entry IN SELECT s.id FROM app.spaces s WHERE EXISTS(
    SELECT 1 FROM app.space_allocations a LEFT JOIN app.holds h ON h.allocation_id=a.id
      LEFT JOIN app.reservations r ON r.allocation_id=a.id
    WHERE a.space_id=s.id AND a.released_at IS NULL AND
      ((h.state='held' AND h.expires_at<=clock_timestamp()) OR (r.status='confirmed' AND a.ends_at<=clock_timestamp())))
    ORDER BY s.id FOR UPDATE OF s SKIP LOCKED LIMIT 200 LOOP
    PERFORM app.expire_space(entry.id); n:=n+1;
  END LOOP;
  RETURN n;
END $$;
CREATE FUNCTION app.available_spaces(p_facility uuid,p_start timestamptz,p_end timestamptz)
RETURNS TABLE(id uuid,label text,floor_name text,available boolean,active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE entry record;
BEGIN
  IF p_end<=p_start OR p_end-p_start>interval '24 hours' THEN RAISE EXCEPTION '400|INVALID_WINDOW|Invalid availability window.'; END IF;
  IF NOT app.visible_facility(p_facility) THEN RAISE EXCEPTION '404|NOT_FOUND|Facility not found.'; END IF;
  FOR entry IN SELECT s.id FROM app.spaces s WHERE s.facility_id=p_facility ORDER BY s.id LOOP
    PERFORM app.expire_space(entry.id);
  END LOOP;
  RETURN QUERY SELECT s.id,s.label,f.name,s.active AND NOT EXISTS(
    SELECT 1 FROM app.space_allocations a WHERE a.space_id=s.id AND a.released_at IS NULL
      AND a.time_range && tstzrange(p_start,p_end,'[)')),s.active
    FROM app.spaces s JOIN app.floors f ON f.id=s.floor_id WHERE s.facility_id=p_facility ORDER BY s.label;
END $$;
CREATE FUNCTION app.hold_space(p_space uuid,p_start timestamptz,p_end timestamptz,p_quote integer,p_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE existing record; space record; price integer; claim uuid; identity uuid; amount integer;
BEGIN
  IF NOT app.has_role('driver') THEN RAISE EXCEPTION '403|DRIVER_REQUIRED|Driver access is required.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('hold:'||app.uid()::text||p_key::text,0));
  SELECT h.*,a.space_id,a.starts_at,a.ends_at INTO existing FROM app.holds h JOIN app.space_allocations a ON a.id=h.allocation_id
    WHERE h.user_id=app.uid() AND h.request_key=p_key;
  IF FOUND THEN
    IF existing.space_id<>p_space OR existing.starts_at<>p_start OR existing.ends_at<>p_end OR existing.hourly_kzt<>p_quote THEN
      RAISE EXCEPTION '409|IDEMPOTENCY_CONFLICT|This request key was used for different details.';
    END IF;
    RETURN jsonb_build_object('id',existing.id,'state',existing.state,'expiresAt',existing.expires_at,'total',existing.total_kzt,'replayed',true);
  END IF;
  IF p_start<clock_timestamp() OR p_start>clock_timestamp()+interval '90 days'
    OR p_end-p_start<interval '1 hour' OR p_end-p_start>interval '24 hours'
    OR date_trunc('hour',p_start)<>p_start OR date_trunc('hour',p_end)<>p_end THEN
    RAISE EXCEPTION '400|INVALID_WINDOW|Choose whole-hour slots, 1–24 hours, within the next 90 days.';
  END IF;
  SELECT s.*,f.approved,f.operator_id INTO space FROM app.spaces s JOIN app.facilities f ON f.id=s.facility_id
    JOIN app.operators o ON o.id=f.operator_id WHERE s.id=p_space AND s.active AND f.approved AND o.active FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Space is unavailable.'; END IF;
  PERFORM app.expire_space(p_space);
  IF (SELECT count(*) FROM app.holds WHERE user_id=app.uid() AND state='held' AND expires_at>clock_timestamp())>=3 THEN
    RAISE EXCEPTION '429|HOLD_LIMIT|Confirm or release an existing hold before creating another.';
  END IF;
  SELECT hourly_kzt INTO price FROM app.pricing_rules WHERE facility_id=space.facility_id AND active;
  IF price IS NULL OR price<>p_quote THEN RAISE EXCEPTION '409|PRICE_CHANGED|The price changed. Refresh the listing.'; END IF;
  amount:=(extract(epoch FROM (p_end-p_start))/3600)::integer*price;
  INSERT INTO app.space_allocations(space_id,facility_id,user_id,kind,starts_at,ends_at)
    VALUES(p_space,space.facility_id,app.uid(),'hold',p_start,p_end) RETURNING id INTO claim;
  INSERT INTO app.holds(user_id,allocation_id,request_key,hourly_kzt,total_kzt,state,expires_at)
    VALUES(app.uid(),claim,p_key,price,amount,'held',clock_timestamp()+interval '5 minutes') RETURNING id INTO identity;
  RETURN (SELECT jsonb_build_object('id',id,'state',state,'expiresAt',expires_at,'total',total_kzt) FROM app.holds WHERE id=identity);
END $$;
CREATE FUNCTION app.confirm_hold(p_hold uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE held record; claim record; reservation app.reservations;
BEGIN
  IF NOT app.has_role('driver') THEN RAISE EXCEPTION '403|DRIVER_REQUIRED|Driver access is required.'; END IF;
  SELECT h.*,a.space_id INTO held FROM app.holds h JOIN app.space_allocations a ON a.id=h.allocation_id
    WHERE h.id=p_hold AND h.user_id=app.uid();
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Hold not found.'; END IF;
  PERFORM 1 FROM app.spaces WHERE id=held.space_id FOR UPDATE;
  PERFORM app.expire_space(held.space_id);
  SELECT * INTO held FROM app.holds WHERE id=p_hold FOR UPDATE;
  IF held.state='confirmed' THEN
    SELECT * INTO reservation FROM app.reservations WHERE hold_id=p_hold;
    RETURN jsonb_build_object('id',reservation.id,'reference',reservation.reference,'total',reservation.total_kzt,'status',reservation.status,'replayed',true);
  END IF;
  IF held.state='expired' THEN
    RETURN jsonb_build_object('errorCode','HOLD_EXPIRED','message','Your hold expired. Select a space again.');
  END IF;
  IF held.state<>'held' THEN RAISE EXCEPTION '409|INVALID_STATUS|Hold is no longer active.'; END IF;
  SELECT * INTO claim FROM app.space_allocations WHERE id=held.allocation_id FOR UPDATE;
  IF claim.starts_at<=clock_timestamp() THEN
    UPDATE app.holds SET state='expired' WHERE id=p_hold;
    UPDATE app.space_allocations SET released_at=clock_timestamp() WHERE id=claim.id;
    RETURN jsonb_build_object('errorCode','HOLD_EXPIRED','message','The reservation start time has passed.');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM app.facilities f JOIN app.operators o ON o.id=f.operator_id WHERE f.id=claim.facility_id AND f.approved AND o.active) THEN
    RAISE EXCEPTION '409|FACILITY_UNAVAILABLE|This facility is no longer accepting reservations.';
  END IF;
  UPDATE app.space_allocations SET kind='reservation' WHERE id=claim.id;
  INSERT INTO app.reservations(user_id,facility_id,hold_id,allocation_id,hourly_kzt,original_total_kzt,total_kzt,status)
    VALUES(app.uid(),claim.facility_id,p_hold,claim.id,held.hourly_kzt,held.total_kzt,held.total_kzt,'confirmed') RETURNING * INTO reservation;
  UPDATE app.holds SET state='confirmed' WHERE id=p_hold;
  RETURN jsonb_build_object('id',reservation.id,'reference',reservation.reference,'total',reservation.total_kzt,'status',reservation.status);
END $$;
CREATE FUNCTION app.release_hold(p_hold uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE held record;
BEGIN
  SELECT h.*,a.space_id INTO held FROM app.holds h JOIN app.space_allocations a ON a.id=h.allocation_id
    WHERE h.id=p_hold AND h.user_id=app.uid();
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Hold not found.'; END IF;
  PERFORM 1 FROM app.spaces WHERE id=held.space_id FOR UPDATE;
  SELECT * INTO held FROM app.holds WHERE id=p_hold FOR UPDATE;
  IF held.state='held' THEN
    UPDATE app.holds SET state='cancelled' WHERE id=p_hold;
    UPDATE app.space_allocations SET released_at=clock_timestamp() WHERE id=held.allocation_id;
  END IF;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE FUNCTION app.request_replay(p_key uuid,p_kind text,p_target uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE previous app.action_requests;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('action:'||app.uid()::text||p_key::text,0));
  SELECT * INTO previous FROM app.action_requests WHERE user_id=app.uid() AND request_key=p_key;
  IF FOUND THEN
    IF previous.kind<>p_kind OR previous.target_id<>p_target OR previous.payload<>p_payload THEN
      RAISE EXCEPTION '409|IDEMPOTENCY_CONFLICT|This request key was used for different details.';
    END IF;
    RETURN previous.result;
  END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION app.request_done(p_key uuid,p_kind text,p_target uuid,p_payload jsonb,p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  INSERT INTO app.action_requests(user_id,request_key,kind,target_id,payload,result) VALUES(app.uid(),p_key,p_kind,p_target,p_payload,p_result);
  RETURN p_result;
END $$;
CREATE FUNCTION app.cancel_reservation(p_id uuid,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE reservation record; prior jsonb; target text; result jsonb;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION '401|AUTH_REQUIRED|Sign in to continue.'; END IF;
  prior:=app.request_replay(p_key,'cancel',p_id,'{}'); IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT r.*,a.space_id,a.starts_at INTO reservation FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id
    WHERE r.id=p_id AND (r.user_id=app.uid() OR app.can_manage(r.facility_id));
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Reservation not found.'; END IF;
  PERFORM 1 FROM app.spaces WHERE id=reservation.space_id FOR UPDATE;
  SELECT r.*,a.starts_at INTO reservation FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id WHERE r.id=p_id FOR UPDATE OF r;
  IF reservation.status IN ('cancelled','operator_cancelled') THEN
    result:=jsonb_build_object('id',p_id,'status',reservation.status,'replayed',true);
  ELSE
    IF reservation.status<>'confirmed' OR EXISTS(SELECT 1 FROM app.parking_sessions WHERE reservation_id=p_id AND state='active') THEN
      RAISE EXCEPTION '409|INVALID_STATUS|This reservation cannot be cancelled.';
    END IF;
    IF reservation.user_id=app.uid() AND NOT app.can_manage(reservation.facility_id) AND reservation.starts_at<=clock_timestamp() THEN
      RAISE EXCEPTION '409|CANCELLATION_CLOSED|Cancel before the start time or contact the operator.';
    END IF;
    target:=CASE WHEN reservation.user_id=app.uid() THEN 'cancelled' ELSE 'operator_cancelled' END;
    UPDATE app.reservations SET status=target WHERE id=p_id;
    UPDATE app.space_allocations SET released_at=clock_timestamp() WHERE id=reservation.allocation_id;
    result:=jsonb_build_object('id',p_id,'status',target);
  END IF;
  RETURN app.request_done(p_key,'cancel',p_id,'{}',result);
END $$;
CREATE FUNCTION app.extend_reservation(p_id uuid,p_end timestamptz,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE reservation record; prior jsonb; payload jsonb:=jsonb_build_object('end',p_end); amount integer; result jsonb;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION '401|AUTH_REQUIRED|Sign in to continue.'; END IF;
  prior:=app.request_replay(p_key,'extend',p_id,payload); IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT r.*,a.space_id,a.starts_at,a.ends_at INTO reservation FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id
    WHERE r.id=p_id AND (r.user_id=app.uid() OR app.can_manage(r.facility_id));
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Reservation not found.'; END IF;
  PERFORM 1 FROM app.spaces WHERE id=reservation.space_id FOR UPDATE;
  PERFORM app.expire_space(reservation.space_id);
  SELECT r.*,a.space_id,a.starts_at,a.ends_at INTO reservation FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id WHERE r.id=p_id FOR UPDATE OF r;
  IF reservation.status<>'confirmed' OR reservation.ends_at<=clock_timestamp() OR p_end<=reservation.ends_at
    OR p_end-reservation.starts_at>interval '24 hours' OR date_trunc('hour',p_end)<>p_end THEN
    RAISE EXCEPTION '409|INVALID_EXTENSION|Choose a later whole hour within the 24-hour maximum.';
  END IF;
  amount:=(extract(epoch FROM(p_end-reservation.ends_at))/3600)::integer*reservation.hourly_kzt;
  UPDATE app.space_allocations SET ends_at=p_end WHERE id=reservation.allocation_id;
  INSERT INTO app.reservation_extensions(reservation_id,old_end,new_end,added_kzt,request_key,created_by)
    VALUES(p_id,reservation.ends_at,p_end,amount,p_key,app.uid());
  UPDATE app.reservations SET total_kzt=total_kzt+amount WHERE id=p_id;
  INSERT INTO app.booking_status_history(reservation_id,from_status,to_status,actor_id) VALUES(p_id,'confirmed','extended',app.uid());
  INSERT INTO app.audit_logs(actor_id,action,target_id,facility_id,details) VALUES(app.uid(),'reservation.extended',p_id::text,reservation.facility_id,jsonb_build_object('added_kzt',amount,'new_end',p_end));
  result:=jsonb_build_object('id',p_id,'status','confirmed','newEnd',p_end,'total',reservation.total_kzt+amount);
  RETURN app.request_done(p_key,'extend',p_id,payload,result);
END $$;
