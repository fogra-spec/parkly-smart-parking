-- A short-lived encrypted-push capability reveals generic reminder text only.
-- Opening booking details still requires normal account authentication/RLS.
CREATE FUNCTION app.push_event_view(p_delivery uuid,p_device uuid)
RETURNS TABLE(reservation_id uuid,kind text,valid_until timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT j.reservation_id,j.kind,j.valid_until FROM app.reminder_deliveries d
    JOIN app.push_devices s ON s.id=d.device_id JOIN app.reminder_jobs j ON j.id=d.job_id
    WHERE d.id=p_delivery AND d.device_id=p_device AND s.active AND app.reminder_valid(j.id)
      AND d.state IN ('sending','retry','accepted') AND coalesce((SELECT push FROM app.notification_preferences WHERE user_id=d.user_id),false)
$$;
CREATE FUNCTION app.ack_push_display(p_delivery uuid,p_device uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM app.push_event_view(p_delivery,p_device)) THEN RAISE EXCEPTION '410|STALE_REMINDER|The reminder is no longer valid.';END IF;
  UPDATE app.reminder_deliveries SET display_requested_at=coalesce(display_requested_at,clock_timestamp()) WHERE id=p_delivery AND device_id=p_device;
END $$;
CREATE FUNCTION app.parking_extension_options(p_booking uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE r record; options jsonb;
BEGIN
  SELECT booking.*,a.space_id,a.starts_at,a.ends_at INTO r FROM app.reservations booking JOIN app.space_allocations a ON a.id=booking.allocation_id
    WHERE booking.id=p_booking AND (booking.user_id=app.uid() OR app.can_manage(booking.facility_id));
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Reservation not found.';END IF;
  PERFORM app.expire_space(r.space_id);
  IF r.status<>'confirmed' OR r.ends_at<=clock_timestamp() THEN RETURN jsonb_build_object('options','[]'::jsonb,'reason','This reservation has ended or is no longer confirmed.');END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('hours',h,'end',extract(epoch FROM(r.ends_at+make_interval(hours=>h)))*1000,
    'addedPrice',h*r.hourly_kzt,'newTotal',r.total_kzt+h*r.hourly_kzt,
    'available',NOT EXISTS(SELECT 1 FROM app.space_allocations claim WHERE claim.space_id=r.space_id AND claim.id<>r.allocation_id AND claim.released_at IS NULL
      AND claim.time_range&&tstzrange(r.ends_at,r.ends_at+make_interval(hours=>h),'[)'))) ORDER BY h),'[]'::jsonb)
    INTO options FROM generate_series(1,23) h WHERE r.ends_at+make_interval(hours=>h)-r.starts_at<=interval '24 hours';
  RETURN jsonb_build_object('bookingId',r.id,'hourly',r.hourly_kzt,'currency','KZT','options',options,
    'reason',CASE WHEN options='[]'::jsonb THEN 'The 24-hour reservation limit has been reached.' ELSE 'Unavailable durations overlap a reservation, hold or maintenance block.' END);
END $$;
CREATE OR REPLACE FUNCTION auth.open_session(p_user uuid,p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF length(p_hash)<>64 OR NOT EXISTS(SELECT 1 FROM app.profiles WHERE id=p_user AND active) THEN RAISE EXCEPTION '401|AUTH_REQUIRED|Account is not available.';END IF;
  INSERT INTO auth.sessions(token_hash,user_id,expires_at) VALUES(p_hash,p_user,clock_timestamp()+interval '1 day');
  INSERT INTO app.audit_logs(actor_id,action,target_id) VALUES(p_user,'auth.signed_in',p_user::text);
  -- Device opt-in may outlive the 24h browser login. Explicit logout/disable
  -- still revokes it; inactive capabilities and sessions can be cleaned safely.
  DELETE FROM auth.sessions s WHERE s.expires_at<clock_timestamp()-interval '7 days'
    AND NOT EXISTS(SELECT 1 FROM app.push_devices d WHERE d.session_hash=s.token_hash AND d.active);
END $$;
REVOKE ALL ON FUNCTION app.push_event_view(uuid,uuid),app.ack_push_display(uuid,uuid),app.parking_extension_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.push_event_view(uuid,uuid),app.ack_push_display(uuid,uuid),app.parking_extension_options(uuid) TO parkly_app;
