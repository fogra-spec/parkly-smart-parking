CREATE FUNCTION auth.register_account(p_email text,p_name text,p_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE identity uuid:=gen_random_uuid();
BEGIN
  IF p_email<>lower(trim(p_email)) OR length(p_email)>254 OR position('@' IN p_email)<2
    OR p_hash NOT LIKE 'scrypt$32768$8$3$%' THEN
    RAISE EXCEPTION '400|INVALID_ACCOUNT|Invalid account details.';
  END IF;
  PERFORM set_config('parkly.user_id',identity::text,true);
  INSERT INTO app.profiles(id,name) VALUES(identity,p_name);
  INSERT INTO auth.accounts(user_id,email,password_hash) VALUES(identity,p_email,p_hash);
  INSERT INTO app.user_roles(user_id,role) VALUES(identity,'driver');
  INSERT INTO app.notification_preferences(user_id) VALUES(identity);
  RETURN identity;
END $$;
CREATE FUNCTION auth.credentials(p_email text) RETURNS TABLE(user_id uuid,password_hash text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT a.user_id,a.password_hash FROM auth.accounts a JOIN app.profiles p ON p.id=a.user_id
  WHERE a.email=p_email AND p.active
$$;
CREATE FUNCTION auth.open_session(p_user uuid,p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF length(p_hash)<>64 OR NOT EXISTS(SELECT 1 FROM app.profiles WHERE id=p_user AND active) THEN
    RAISE EXCEPTION '401|AUTH_REQUIRED|Account is not available.';
  END IF;
  INSERT INTO auth.sessions(token_hash,user_id,expires_at) VALUES(p_hash,p_user,clock_timestamp()+interval '1 day');
  DELETE FROM auth.sessions WHERE expires_at<clock_timestamp()-interval '7 days';
END $$;
CREATE FUNCTION auth.session_user(p_hash text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT s.user_id FROM auth.sessions s JOIN app.profiles p ON p.id=s.user_id
  WHERE s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND p.active
$$;
CREATE FUNCTION auth.close_session(p_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
  UPDATE auth.sessions SET revoked_at=clock_timestamp() WHERE token_hash=p_hash AND revoked_at IS NULL
$$;
CREATE FUNCTION auth.consume_limit(p_key text,p_limit integer,p_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE n integer;
BEGIN
  IF length(p_key)<>64 OR p_limit NOT BETWEEN 1 AND 1000 OR p_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION '400|INVALID_LIMIT|Invalid rate-limit parameters.';
  END IF;
  INSERT INTO auth.rate_limits(key,window_start,attempts) VALUES(p_key,clock_timestamp(),1)
  ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN auth.rate_limits.window_start<clock_timestamp()-make_interval(secs=>p_seconds) THEN 1 ELSE auth.rate_limits.attempts+1 END,
    window_start=CASE WHEN auth.rate_limits.window_start<clock_timestamp()-make_interval(secs=>p_seconds) THEN clock_timestamp() ELSE auth.rate_limits.window_start END
  RETURNING attempts INTO n;
  RETURN n<=p_limit;
END $$;
