CREATE FUNCTION app.extend_quoted_reservation(p_id uuid,p_end timestamptz,p_key uuid,p_total integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE r record; previous jsonb; expected integer;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION '401|AUTH_REQUIRED|Sign in to continue.';END IF;
  previous:=app.request_replay(p_key,'extend',p_id,jsonb_build_object('end',p_end));IF previous IS NOT NULL THEN RETURN previous;END IF;
  SELECT booking.*,a.space_id INTO r FROM app.reservations booking JOIN app.space_allocations a ON a.id=booking.allocation_id WHERE booking.id=p_id AND (booking.user_id=app.uid() OR app.can_manage(booking.facility_id));
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Reservation not found.';END IF;
  PERFORM 1 FROM app.spaces WHERE id=r.space_id FOR UPDATE;
  SELECT booking.*,a.ends_at INTO r FROM app.reservations booking JOIN app.space_allocations a ON a.id=booking.allocation_id WHERE booking.id=p_id FOR UPDATE OF booking;
  expected:=r.total_kzt+(extract(epoch FROM(p_end-r.ends_at))/3600)::integer*r.hourly_kzt;
  IF expected<>p_total THEN RAISE EXCEPTION '409|PRICE_CHANGED|The extension quote changed. Review the latest price.';END IF;
  RETURN app.extend_reservation(p_id,p_end,p_key);
END $$;
REVOKE ALL ON FUNCTION app.extend_quoted_reservation(uuid,timestamptz,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.extend_quoted_reservation(uuid,timestamptz,uuid,integer) TO parkly_app;
