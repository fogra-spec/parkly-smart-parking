CREATE FUNCTION auth.own_password_hash() RETURNS text LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
 SELECT a.password_hash FROM auth.accounts a JOIN app.profiles p ON p.id=a.user_id WHERE a.user_id=app.uid() AND p.active
$$;
CREATE FUNCTION auth.change_password(p_previous text,p_next text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
 IF app.uid() IS NULL THEN RAISE EXCEPTION '401|AUTH_REQUIRED|Sign in to change your password.'; END IF;
 IF p_next !~ '^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$' THEN RAISE EXCEPTION '400|INVALID_HASH|Invalid password encoding.'; END IF;
 UPDATE auth.accounts SET password_hash=p_next WHERE user_id=app.uid() AND password_hash=p_previous;
 IF NOT FOUND THEN RAISE EXCEPTION '409|CREDENTIALS_CHANGED|Credentials changed. Sign in again.'; END IF;
 UPDATE auth.sessions SET revoked_at=clock_timestamp() WHERE user_id=app.uid() AND revoked_at IS NULL;
 INSERT INTO app.audit_logs(actor_id,action,target_id) VALUES(app.uid(),'account.password_changed',app.uid()::text);
 RETURN jsonb_build_object('ok',true,'reauthenticationRequired',true);
END $$;
REVOKE ALL ON FUNCTION auth.own_password_hash(),auth.change_password(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.own_password_hash(),auth.change_password(text,text) TO parkly_app;
