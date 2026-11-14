-- Do not repeatedly spend a bounded cleanup batch on open operator sessions.
-- This preserves the existing manual-session policy while preventing an
-- overdue session from starving expired holds/reservations behind it.
CREATE OR REPLACE FUNCTION app.expire_due() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE entry record; n integer:=0;
BEGIN
  FOR entry IN SELECT s.id FROM app.spaces s WHERE EXISTS(
    SELECT 1 FROM app.space_allocations a LEFT JOIN app.holds h ON h.allocation_id=a.id
      LEFT JOIN app.reservations r ON r.allocation_id=a.id
    WHERE a.space_id=s.id AND a.released_at IS NULL AND
      ((h.state='held' AND h.expires_at<=clock_timestamp()) OR (r.status='confirmed' AND a.ends_at<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM app.parking_sessions ps WHERE ps.reservation_id=r.id AND ps.state='active'))))
    ORDER BY s.id FOR UPDATE OF s SKIP LOCKED LIMIT 200 LOOP
    PERFORM app.expire_space(entry.id); n:=n+1;
  END LOOP;
  RETURN n;
END $$;
