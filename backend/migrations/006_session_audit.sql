CREATE OR REPLACE FUNCTION auth.open_session(p_user uuid,p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF length(p_hash)<>64 OR NOT EXISTS(SELECT 1 FROM app.profiles WHERE id=p_user AND active) THEN
    RAISE EXCEPTION '401|AUTH_REQUIRED|Account is not available.';
  END IF;
  INSERT INTO auth.sessions(token_hash,user_id,expires_at) VALUES(p_hash,p_user,clock_timestamp()+interval '1 day');
  INSERT INTO app.audit_logs(actor_id,action,target_id) VALUES(p_user,'auth.signed_in',p_user::text);
  DELETE FROM auth.sessions WHERE expires_at<clock_timestamp()-interval '7 days';
END $$;
CREATE OR REPLACE FUNCTION auth.close_session(p_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
  WITH revoked AS (UPDATE auth.sessions SET revoked_at=clock_timestamp() WHERE token_hash=p_hash AND revoked_at IS NULL RETURNING user_id)
  INSERT INTO app.audit_logs(actor_id,action,target_id) SELECT user_id,'auth.signed_out',user_id::text FROM revoked
$$;
CREATE FUNCTION app.read_notification(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  UPDATE app.notification_deliveries SET read_at=coalesce(read_at,clock_timestamp()) WHERE id=p_id AND user_id=app.uid();
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Notification not found.'; END IF;
END $$;
REVOKE ALL ON FUNCTION app.read_notification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.read_notification(uuid) TO parkly_app;
