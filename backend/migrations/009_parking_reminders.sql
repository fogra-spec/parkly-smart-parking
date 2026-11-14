-- Durable scheduling and encrypted, session-bound device capabilities.
CREATE ROLE parkly_notifications NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT USAGE ON SCHEMA app TO parkly_notifications;
ALTER TABLE app.reservations ADD COLUMN reminder_version integer NOT NULL DEFAULT 1;
ALTER TABLE app.notification_preferences ADD COLUMN remind_30 boolean NOT NULL DEFAULT true;
ALTER TABLE app.notification_preferences ADD COLUMN remind_15 boolean NOT NULL DEFAULT true;
ALTER TABLE app.notification_preferences ADD COLUMN remind_5 boolean NOT NULL DEFAULT true;
ALTER TABLE app.notification_preferences ADD COLUMN remind_end boolean NOT NULL DEFAULT true;
CREATE TABLE app.push_devices(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES app.profiles(id),
  session_hash text REFERENCES auth.sessions(token_hash) ON DELETE SET NULL,endpoint_hash text NOT NULL,
  ciphertext text,vapid_key_id text NOT NULL,label text NOT NULL CHECK(length(label) BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,disabled_reason text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(NOT active OR (ciphertext IS NOT NULL AND session_hash IS NOT NULL))
);
CREATE UNIQUE INDEX active_push_endpoint ON app.push_devices(endpoint_hash) WHERE active;
CREATE INDEX push_devices_user ON app.push_devices(user_id) WHERE active;
CREATE TABLE app.reminder_jobs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reservation_id uuid NOT NULL REFERENCES app.reservations(id),
  user_id uuid NOT NULL REFERENCES app.profiles(id),version integer NOT NULL,expected_end timestamptz NOT NULL,
  kind text NOT NULL CHECK(kind IN ('30','15','5','end','test')),due_at timestamptz NOT NULL,valid_until timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','dispatched','cancelled','missed')),
  reason text,target_device uuid REFERENCES app.push_devices(id),request_key uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(reservation_id,version,kind,request_key)
);
CREATE UNIQUE INDEX scheduled_reminder_unique ON app.reminder_jobs(reservation_id,version,kind) WHERE kind<>'test';
CREATE UNIQUE INDEX test_reminder_key ON app.reminder_jobs(user_id,request_key) WHERE kind='test';
CREATE INDEX due_reminders ON app.reminder_jobs(due_at) WHERE state='pending';
CREATE TABLE app.reminder_deliveries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES app.reminder_jobs(id),
  device_id uuid NOT NULL REFERENCES app.push_devices(id),user_id uuid NOT NULL REFERENCES app.profiles(id),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retry','accepted','failed','expired','cancelled')),
  attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  worker_id uuid,lease_token uuid,lease_until timestamptz,last_http_status integer,last_error_code text,
  accepted_at timestamptz,display_requested_at timestamptz,UNIQUE(job_id,device_id)
);
CREATE INDEX ready_push_delivery ON app.reminder_deliveries(next_attempt_at) WHERE state IN ('pending','retry','sending');
CREATE TABLE app.reminder_attempts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),delivery_id uuid NOT NULL REFERENCES app.reminder_deliveries(id),
  attempt integer NOT NULL,started_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_at timestamptz,
  outcome text NOT NULL DEFAULT 'started',http_status integer,error_code text,UNIQUE(delivery_id,attempt)
);
CREATE TABLE app.notification_workers(id uuid PRIMARY KEY,last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE app.notification_deliveries ADD COLUMN reminder_job_id uuid REFERENCES app.reminder_jobs(id);
CREATE UNIQUE INDEX in_app_reminder_once ON app.notification_deliveries(reminder_job_id,channel) WHERE reminder_job_id IS NOT NULL;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['push_devices','reminder_jobs','reminder_deliveries','reminder_attempts','notification_workers'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',tab);
  END LOOP;
END $$;
CREATE POLICY own_devices ON app.push_devices FOR SELECT TO parkly_app USING(user_id=app.uid());
CREATE POLICY own_jobs ON app.reminder_jobs FOR SELECT TO parkly_app USING(user_id=app.uid());
CREATE POLICY own_deliveries ON app.reminder_deliveries FOR SELECT TO parkly_app USING(user_id=app.uid());
CREATE POLICY own_attempts ON app.reminder_attempts FOR SELECT TO parkly_app USING(EXISTS(SELECT 1 FROM app.reminder_deliveries d WHERE d.id=delivery_id));
GRANT SELECT ON app.push_devices,app.reminder_jobs,app.reminder_deliveries,app.reminder_attempts TO parkly_app;
-- Legacy plaintext subscriptions remain preserved, but no longer accept writes.
REVOKE INSERT,UPDATE,DELETE ON app.push_subscriptions FROM parkly_app;

CREATE FUNCTION app.schedule_parking_reminders(p_id uuid,p_changed boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE r record; threshold text; due timestamptz;
BEGIN
  SELECT booking.*,a.ends_at INTO r FROM app.reservations booking JOIN app.space_allocations a ON a.id=booking.allocation_id WHERE booking.id=p_id FOR UPDATE OF booking;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_changed THEN
    UPDATE app.reminder_jobs SET state='cancelled',reason='booking_changed' WHERE reservation_id=p_id AND state IN ('pending','dispatched');
    UPDATE app.reminder_deliveries SET state='cancelled' WHERE job_id IN(SELECT id FROM app.reminder_jobs WHERE reservation_id=p_id) AND state IN ('pending','retry','sending');
    UPDATE app.reservations SET reminder_version=reminder_version+1 WHERE id=p_id RETURNING reminder_version INTO r.reminder_version;
  END IF;
  IF r.status NOT IN ('confirmed','expired') THEN
    UPDATE app.reminder_jobs SET state='cancelled',reason='booking_closed' WHERE reservation_id=p_id;
    UPDATE app.reminder_deliveries SET state='cancelled' WHERE job_id IN(SELECT id FROM app.reminder_jobs WHERE reservation_id=p_id) AND state IN ('pending','retry','sending');
    RETURN;
  END IF;
  IF r.status='expired' THEN
    UPDATE app.reminder_jobs SET state='cancelled',reason='reservation_ended' WHERE reservation_id=p_id AND kind NOT IN ('end') AND state='pending';
    RETURN;
  END IF;
  FOREACH threshold IN ARRAY ARRAY['30','15','5','end'] LOOP
    due:=CASE WHEN threshold='end' THEN r.ends_at ELSE r.ends_at-make_interval(mins=>threshold::integer) END;
    INSERT INTO app.reminder_jobs(reservation_id,user_id,version,expected_end,kind,due_at,valid_until,state,reason)
      VALUES(p_id,r.user_id,r.reminder_version,r.ends_at,threshold,due,
        CASE WHEN threshold='end' THEN due+interval '10 minutes' ELSE least(r.ends_at,due+interval '2 minutes') END,
        CASE WHEN due<clock_timestamp() THEN 'missed' ELSE 'pending' END,
        CASE WHEN due<clock_timestamp() THEN 'created_after_threshold' ELSE NULL END)
      ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
CREATE FUNCTION app.reminder_booking_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME='space_allocations' THEN
    IF OLD.ends_at IS DISTINCT FROM NEW.ends_at THEN PERFORM app.schedule_parking_reminders(id,true) FROM app.reservations WHERE allocation_id=NEW.id; END IF;
  ELSE PERFORM app.schedule_parking_reminders(NEW.id); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reservation_reminders AFTER INSERT OR UPDATE OF status ON app.reservations FOR EACH ROW EXECUTE FUNCTION app.reminder_booking_changed();
CREATE TRIGGER extension_reminders AFTER UPDATE OF ends_at ON app.space_allocations FOR EACH ROW EXECUTE FUNCTION app.reminder_booking_changed();
DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM app.reservations WHERE status='confirmed' LOOP PERFORM app.schedule_parking_reminders(r.id);END LOOP;END $$;

CREATE FUNCTION app.register_push_device(p_session text,p_hash text,p_cipher text,p_key text,p_label text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE identity uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE token_hash=p_session AND user_id=app.uid() AND revoked_at IS NULL AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION '401|AUTH_REQUIRED|Sign in before enabling reminders.';END IF;
  IF length(p_hash)<>64 OR length(p_cipher)>8192 OR length(p_cipher)<40 OR length(p_label) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION '400|INVALID_DEVICE|Invalid device subscription.';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('push:'||p_hash,0));
  SELECT id INTO identity FROM app.push_devices WHERE endpoint_hash=p_hash AND active AND user_id=app.uid() AND session_hash=p_session;
  IF FOUND THEN UPDATE app.push_devices SET ciphertext=p_cipher,vapid_key_id=p_key,label=p_label,updated_at=clock_timestamp() WHERE id=identity;RETURN identity;END IF;
  UPDATE app.push_devices SET active=false,ciphertext=NULL,disabled_reason='rebound' WHERE endpoint_hash=p_hash AND active;
  INSERT INTO app.push_devices(user_id,session_hash,endpoint_hash,ciphertext,vapid_key_id,label) VALUES(app.uid(),p_session,p_hash,p_cipher,p_key,p_label) RETURNING id INTO identity;
  RETURN identity;
END $$;
CREATE FUNCTION app.revoke_push_device(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  UPDATE app.push_devices SET active=false,ciphertext=NULL,disabled_reason='user_unsubscribed' WHERE id=p_id AND user_id=app.uid();
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Device not found.';END IF;
  UPDATE app.reminder_deliveries SET state='cancelled' WHERE device_id=p_id AND state IN ('pending','retry','sending');
END $$;
CREATE FUNCTION app.revoke_session_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE app.push_devices SET active=false,ciphertext=NULL,disabled_reason='session_removed' WHERE session_hash=OLD.token_hash;
    UPDATE app.reminder_deliveries SET state='cancelled' WHERE device_id IN(SELECT id FROM app.push_devices WHERE session_hash=OLD.token_hash) AND state IN ('pending','retry','sending');
    RETURN OLD;
  END IF;
  IF NEW.revoked_at IS NOT NULL THEN
    UPDATE app.push_devices SET active=false,ciphertext=NULL,disabled_reason='signed_out' WHERE session_hash=NEW.token_hash AND active;
    UPDATE app.reminder_deliveries SET state='cancelled' WHERE device_id IN(SELECT id FROM app.push_devices WHERE session_hash=NEW.token_hash) AND state IN ('pending','retry','sending');
  END IF;RETURN NEW;
END $$;
CREATE TRIGGER session_push_delete BEFORE DELETE ON auth.sessions FOR EACH ROW EXECUTE FUNCTION app.revoke_session_push();
CREATE TRIGGER session_push_revoke AFTER UPDATE OF revoked_at ON auth.sessions FOR EACH ROW EXECUTE FUNCTION app.revoke_session_push();

CREATE FUNCTION app.reminder_valid(p_job uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM app.reminder_jobs j JOIN app.reservations r ON r.id=j.reservation_id JOIN app.space_allocations a ON a.id=r.allocation_id
    JOIN app.profiles u ON u.id=r.user_id LEFT JOIN app.notification_preferences p ON p.user_id=r.user_id
    WHERE j.id=p_job AND j.state<>'cancelled' AND j.version=r.reminder_version AND a.ends_at=j.expected_end AND u.active
      AND j.valid_until>clock_timestamp() AND (r.status='confirmed' OR r.status='expired' AND j.kind='end')
      AND CASE j.kind WHEN '30' THEN coalesce(p.remind_30,true) WHEN '15' THEN coalesce(p.remind_15,true) WHEN '5' THEN coalesce(p.remind_5,true) WHEN 'end' THEN coalesce(p.remind_end,true) ELSE true END)
$$;
CREATE FUNCTION app.prepare_parking_reminders(p_worker uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE j record; n integer:=0;
BEGIN
  INSERT INTO app.notification_workers(id) VALUES(p_worker) ON CONFLICT(id) DO UPDATE SET last_seen_at=clock_timestamp();
  PERFORM app.expire_due();
  FOR j IN SELECT * FROM app.reminder_jobs WHERE state='pending' AND due_at<=clock_timestamp() ORDER BY due_at,id FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
    IF NOT app.reminder_valid(j.id) THEN UPDATE app.reminder_jobs SET state='missed',reason='stale_expired_or_disabled' WHERE id=j.id;CONTINUE;END IF;
    INSERT INTO app.notification_deliveries(user_id,reservation_id,event,channel,status,reminder_job_id)
      SELECT j.user_id,j.reservation_id,'parking.'||j.kind,'in_app','recorded',j.id WHERE coalesce((SELECT in_app FROM app.notification_preferences WHERE user_id=j.user_id),true)
      ON CONFLICT DO NOTHING;
    INSERT INTO app.reminder_deliveries(job_id,device_id,user_id)
      SELECT j.id,d.id,j.user_id FROM app.push_devices d JOIN app.profiles u ON u.id=d.user_id
      JOIN auth.sessions s ON s.token_hash=d.session_hash
      WHERE d.user_id=j.user_id AND d.active AND u.active AND s.revoked_at IS NULL
        AND (j.target_device IS NULL OR d.id=j.target_device)
        AND coalesce((SELECT push FROM app.notification_preferences WHERE user_id=j.user_id),false)
      ON CONFLICT DO NOTHING;
    UPDATE app.reminder_jobs SET state='dispatched',reason=CASE WHEN EXISTS(SELECT 1 FROM app.reminder_deliveries WHERE job_id=j.id) THEN 'queued_for_devices' ELSE 'in_app_or_no_active_device' END WHERE id=j.id;
    n:=n+1;
  END LOOP;
  -- Cancellation/opt-out/deadline cleanup also covers queued retries.
  UPDATE app.reminder_deliveries d SET state='cancelled',last_error_code='NO_LONGER_VALID'
    WHERE state IN ('pending','retry','sending') AND (NOT app.reminder_valid(job_id) OR NOT EXISTS(SELECT 1 FROM app.push_devices s WHERE s.id=d.device_id AND s.active)
      OR NOT coalesce((SELECT push FROM app.notification_preferences WHERE user_id=d.user_id),false));
  UPDATE app.reminder_attempts a SET finished_at=clock_timestamp(),outcome='unknown_after_worker_loss'
    FROM app.reminder_deliveries d WHERE d.id=a.delivery_id AND d.state='sending' AND d.lease_until<clock_timestamp() AND a.finished_at IS NULL;
  UPDATE app.reminder_deliveries SET state='retry',next_attempt_at=clock_timestamp() WHERE state='sending' AND lease_until<clock_timestamp();
  UPDATE app.reminder_deliveries SET state='failed',last_error_code='ATTEMPT_LIMIT' WHERE state IN ('pending','retry') AND attempts>=5;
  RETURN n;
END $$;
CREATE FUNCTION app.claim_push_deliveries(p_worker uuid) RETURNS TABLE(delivery_id uuid,job_id uuid,device_id uuid,user_id uuid,reservation_id uuid,kind text,valid_until timestamptz,ciphertext text,vapid_key_id text,lease_token uuid,attempt integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  RETURN QUERY WITH picked AS(SELECT d.id FROM app.reminder_deliveries d WHERE d.state IN ('pending','retry') AND d.next_attempt_at<=clock_timestamp() AND d.attempts<5 ORDER BY d.next_attempt_at,d.id FOR UPDATE SKIP LOCKED LIMIT 20),
    claimed AS(UPDATE app.reminder_deliveries d SET state='sending',worker_id=p_worker,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',attempts=d.attempts+1 FROM picked WHERE d.id=picked.id RETURNING d.*),
    logged AS(INSERT INTO app.reminder_attempts(delivery_id,attempt) SELECT c.id,c.attempts FROM claimed c RETURNING reminder_attempts.delivery_id)
    SELECT c.id,j.id,s.id,c.user_id,j.reservation_id,j.kind,j.valid_until,s.ciphertext,s.vapid_key_id,c.lease_token,c.attempts FROM claimed c JOIN app.reminder_jobs j ON j.id=c.job_id JOIN app.push_devices s ON s.id=c.device_id;
END $$;
CREATE FUNCTION app.push_delivery_allowed(p_id uuid,p_lease uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM app.reminder_deliveries d JOIN app.push_devices s ON s.id=d.device_id
    WHERE d.id=p_id AND d.lease_token=p_lease AND d.state='sending' AND s.active AND app.reminder_valid(d.job_id)
      AND coalesce((SELECT push FROM app.notification_preferences WHERE user_id=d.user_id),false))
$$;
CREATE FUNCTION app.finish_push_delivery(p_id uuid,p_worker uuid,p_lease uuid,p_outcome text,p_http integer,p_error text,p_retry integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE d app.reminder_deliveries;
BEGIN
  SELECT * INTO d FROM app.reminder_deliveries WHERE id=p_id AND worker_id=p_worker AND lease_token=p_lease FOR UPDATE;
  IF NOT FOUND THEN RETURN;END IF;
  UPDATE app.reminder_attempts SET finished_at=clock_timestamp(),outcome=p_outcome,http_status=p_http,error_code=left(p_error,80) WHERE delivery_id=p_id AND attempt=d.attempts;
  IF d.state<>'sending' THEN RETURN;END IF;
  UPDATE app.reminder_deliveries SET state=CASE WHEN p_outcome='accepted' THEN 'accepted' WHEN p_outcome='retry' AND attempts<5 AND app.reminder_valid(job_id) THEN 'retry' WHEN p_outcome='cancelled' THEN 'cancelled' ELSE 'failed' END,
    next_attempt_at=clock_timestamp()+make_interval(secs=>greatest(1,least(p_retry,120))),last_http_status=p_http,last_error_code=left(p_error,80),
    accepted_at=CASE WHEN p_outcome='accepted' THEN clock_timestamp() ELSE accepted_at END,lease_until=NULL WHERE id=p_id;
  IF p_http IN (404,410) OR p_outcome='invalid_device' THEN
    UPDATE app.push_devices SET active=false,ciphertext=NULL,disabled_reason='expired_or_invalid' WHERE id=d.device_id;
    UPDATE app.reminder_deliveries SET state='cancelled' WHERE device_id=d.device_id AND state IN ('pending','retry');
  END IF;
END $$;
CREATE FUNCTION app.notification_worker_status() RETURNS timestamptz LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$ SELECT max(last_seen_at) FROM app.notification_workers $$;
CREATE FUNCTION app.queue_test_reminder(p_booking uuid,p_device uuid,p_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE r record; identity uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('push-test:'||app.uid()::text,0));
  SELECT id INTO identity FROM app.reminder_jobs WHERE user_id=app.uid() AND request_key=p_key AND kind='test';IF FOUND THEN RETURN identity;END IF;
  IF NOT EXISTS(SELECT 1 FROM app.push_devices WHERE id=p_device AND user_id=app.uid() AND active) THEN RAISE EXCEPTION '409|DEVICE_REQUIRED|Enable reminders on this device first.';END IF;
  SELECT booking.*,a.ends_at INTO r FROM app.reservations booking JOIN app.space_allocations a ON a.id=booking.allocation_id WHERE booking.id=p_booking AND booking.user_id=app.uid() AND booking.status='confirmed' AND a.ends_at>clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|An active or upcoming own reservation is required.';END IF;
  IF NOT coalesce((SELECT push FROM app.notification_preferences WHERE user_id=app.uid()),false) THEN RAISE EXCEPTION '409|PUSH_DISABLED|Enable push reminders in preferences.';END IF;
  IF EXISTS(SELECT 1 FROM app.reminder_jobs WHERE user_id=app.uid() AND kind='test' AND created_at>clock_timestamp()-interval '1 minute') THEN RAISE EXCEPTION '429|TEST_LIMIT|Wait a minute before sending another test.';END IF;
  INSERT INTO app.reminder_jobs(reservation_id,user_id,version,expected_end,kind,due_at,valid_until,target_device,request_key)
    VALUES(r.id,r.user_id,r.reminder_version,r.ends_at,'test',clock_timestamp(),clock_timestamp()+interval '2 minutes',p_device,p_key) RETURNING id INTO identity;
  RETURN identity;
END $$;
-- Safe operations use checked functions, never owner connections in workers.
REVOKE ALL ON FUNCTION app.schedule_parking_reminders(uuid,boolean),app.reminder_booking_changed(),app.register_push_device(text,text,text,text,text),app.revoke_push_device(uuid),app.revoke_session_push(),app.reminder_valid(uuid),app.prepare_parking_reminders(uuid),app.claim_push_deliveries(uuid),app.push_delivery_allowed(uuid,uuid),app.finish_push_delivery(uuid,uuid,uuid,text,integer,text,integer),app.notification_worker_status(),app.queue_test_reminder(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.register_push_device(text,text,text,text,text),app.revoke_push_device(uuid),app.notification_worker_status(),app.queue_test_reminder(uuid,uuid,uuid) TO parkly_app;
GRANT EXECUTE ON FUNCTION app.prepare_parking_reminders(uuid),app.claim_push_deliveries(uuid),app.push_delivery_allowed(uuid,uuid),app.finish_push_delivery(uuid,uuid,uuid,text,integer,text,integer),app.notification_worker_status() TO parkly_notifications;

-- Status history stays intact; push reminders now use the real outbox.
CREATE OR REPLACE FUNCTION app.log_booking_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
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

  END IF;
  INSERT INTO app.audit_logs(actor_id,action,target_id)
    VALUES(app.uid(),TG_TABLE_NAME||'.'||current_state,NEW.id::text);
  RETURN NEW;
END $$;
