-- Complete operational workflows without granting direct table writes.
CREATE TABLE app.operator_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.profiles(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 request_key uuid NOT NULL, operator_id uuid REFERENCES app.operators(id),
 review_note text NOT NULL DEFAULT '' CHECK(length(review_note)<=2000), reviewed_by uuid REFERENCES app.profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), reviewed_at timestamptz,
 UNIQUE(user_id,request_key)
);
CREATE UNIQUE INDEX application_pending ON app.operator_applications(user_id) WHERE status='pending';
CREATE INDEX applications_created ON app.operator_applications(created_at DESC,id);
CREATE TABLE app.support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.profiles(id),
 reservation_id uuid REFERENCES app.reservations(id), subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 3 AND 120),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
 request_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(user_id,request_key)
);
CREATE INDEX support_user ON app.support_tickets(user_id,updated_at DESC);
CREATE INDEX support_queue ON app.support_tickets(status,updated_at DESC,id);
CREATE TABLE app.support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES app.support_tickets(id),
 author_id uuid NOT NULL REFERENCES app.profiles(id), body text NOT NULL CHECK(length(trim(body)) BETWEEN 3 AND 4000),
 request_key uuid NOT NULL, staff boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(author_id,request_key)
);
CREATE INDEX support_thread ON app.support_messages(ticket_id,created_at,id);
ALTER TABLE app.operator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY applications_read ON app.operator_applications FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.has_role('admin'));
CREATE POLICY tickets_read ON app.support_tickets FOR SELECT TO parkly_app USING(user_id=app.uid() OR app.has_role('admin'));
CREATE POLICY messages_read ON app.support_messages FOR SELECT TO parkly_app USING(EXISTS(SELECT 1 FROM app.support_tickets t WHERE t.id=ticket_id));
GRANT SELECT ON app.operator_applications,app.support_tickets,app.support_messages TO parkly_app;
CREATE TRIGGER application_audit AFTER INSERT OR UPDATE ON app.operator_applications FOR EACH ROW EXECUTE FUNCTION app.log_record_change();
CREATE TRIGGER support_audit AFTER INSERT OR UPDATE ON app.support_tickets FOR EACH ROW EXECUTE FUNCTION app.log_record_change();

CREATE FUNCTION app.apply_operator(p_name text,p_description text,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE previous app.operator_applications; identity uuid;
BEGIN
 IF NOT app.has_role('driver') THEN RAISE EXCEPTION '403|DRIVER_REQUIRED|An active driver account is required.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('operator-application:'||app.uid()::text,0));
 SELECT * INTO previous FROM app.operator_applications WHERE user_id=app.uid() AND request_key=p_key;
 IF FOUND THEN
  IF previous.name<>p_name OR previous.description<>p_description THEN RAISE EXCEPTION '409|IDEMPOTENCY_CONFLICT|Request key belongs to different application details.'; END IF;
  RETURN jsonb_build_object('id',previous.id,'status',previous.status);
 END IF;
 IF EXISTS(SELECT 1 FROM app.operator_applications WHERE user_id=app.uid() AND status='pending') THEN RAISE EXCEPTION '409|APPLICATION_PENDING|Your application is already awaiting review.'; END IF;
 INSERT INTO app.operator_applications(user_id,name,description,request_key) VALUES(app.uid(),p_name,p_description,p_key) RETURNING id INTO identity;
 RETURN jsonb_build_object('id',identity,'status','pending');
END $$;
CREATE FUNCTION app.review_operator(p_id uuid,p_approve boolean,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE application app.operator_applications; organization uuid;
BEGIN
 IF NOT app.has_role('admin') THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Administrator access is required.'; END IF;
 IF length(trim(p_note))<3 OR length(p_note)>2000 THEN RAISE EXCEPTION '400|INVALID_NOTE|A review reason of 3 to 2000 characters is required.'; END IF;
 SELECT * INTO application FROM app.operator_applications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Application not found.'; END IF;
 IF application.status<>'pending' THEN
  IF (application.status='approved')<>p_approve THEN RAISE EXCEPTION '409|ALREADY_REVIEWED|This application has already been reviewed.'; END IF;
  RETURN jsonb_build_object('id',application.id,'status',application.status,'operatorId',application.operator_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM app.profiles WHERE id=application.user_id AND active) THEN RAISE EXCEPTION '409|ACCOUNT_DISABLED|Applicant account is disabled.'; END IF;
 IF p_approve THEN
  INSERT INTO app.operators(name) VALUES(application.name) RETURNING id INTO organization;
  INSERT INTO app.operator_memberships(operator_id,user_id) VALUES(organization,application.user_id);
  INSERT INTO app.user_roles(user_id,role) VALUES(application.user_id,'operator') ON CONFLICT DO NOTHING;
 END IF;
 UPDATE app.operator_applications SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 operator_id=organization,review_note=p_note,reviewed_by=app.uid(),reviewed_at=clock_timestamp() WHERE id=p_id;
 RETURN jsonb_build_object('id',p_id,'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,'operatorId',organization);
END $$;

CREATE FUNCTION app.open_support(p_reservation uuid,p_subject text,p_body text,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE previous app.support_tickets; identity uuid;
BEGIN
 IF app.uid() IS NULL THEN RAISE EXCEPTION '401|AUTH_REQUIRED|Sign in to contact support.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('support:'||app.uid()::text||p_key::text,0));
 SELECT * INTO previous FROM app.support_tickets WHERE user_id=app.uid() AND request_key=p_key;
 IF FOUND THEN
  IF previous.subject<>p_subject OR previous.reservation_id IS DISTINCT FROM p_reservation OR NOT EXISTS(SELECT 1 FROM app.support_messages WHERE ticket_id=previous.id AND request_key=p_key AND body=p_body) THEN RAISE EXCEPTION '409|IDEMPOTENCY_CONFLICT|Request key belongs to different support details.'; END IF;
  RETURN jsonb_build_object('id',previous.id);
 END IF;
 IF p_reservation IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.reservations WHERE id=p_reservation AND user_id=app.uid()) THEN RAISE EXCEPTION '404|NOT_FOUND|Your reservation was not found.'; END IF;
 IF (SELECT count(*) FROM app.support_tickets WHERE user_id=app.uid() AND created_at>clock_timestamp()-interval '1 hour')>=10 THEN RAISE EXCEPTION '429|SUPPORT_LIMIT|Too many new requests. Reply to an existing case.'; END IF;
 INSERT INTO app.support_tickets(user_id,reservation_id,subject,request_key) VALUES(app.uid(),p_reservation,p_subject,p_key) RETURNING id INTO identity;
 INSERT INTO app.support_messages(ticket_id,author_id,body,request_key) VALUES(identity,app.uid(),p_body,p_key);
 RETURN jsonb_build_object('id',identity);
END $$;
CREATE FUNCTION app.reply_support(p_id uuid,p_body text,p_key uuid,p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE ticket app.support_tickets; previous app.support_messages; staff boolean:=app.has_role('admin'); identity uuid;
BEGIN
 SELECT * INTO ticket FROM app.support_tickets WHERE id=p_id AND (user_id=app.uid() OR staff) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '404|NOT_FOUND|Support case not found.'; END IF;
 SELECT * INTO previous FROM app.support_messages WHERE author_id=app.uid() AND request_key=p_key;
 IF FOUND THEN
  IF previous.ticket_id<>p_id OR previous.body<>p_body THEN RAISE EXCEPTION '409|IDEMPOTENCY_CONFLICT|Request key belongs to a different reply.'; END IF;
  RETURN jsonb_build_object('id',previous.id);
 END IF;
 IF p_status IS NOT NULL AND (NOT staff OR p_status NOT IN ('open','in_progress','resolved')) THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Only administrators may change case status.'; END IF;
 INSERT INTO app.support_messages(ticket_id,author_id,body,request_key,staff) VALUES(p_id,app.uid(),p_body,p_key,staff) RETURNING id INTO identity;
 UPDATE app.support_tickets SET updated_at=clock_timestamp(),status=coalesce(p_status,CASE WHEN NOT staff THEN 'open' ELSE status END) WHERE id=p_id;
 RETURN jsonb_build_object('id',identity);
END $$;
CREATE FUNCTION app.edit_facility(p_id uuid,p_name text,p_area text,p_address text,p_rules text,p_hours text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
 IF NOT app.can_manage(p_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Assigned facility access is required.'; END IF;
 IF length(trim(p_name)) NOT BETWEEN 2 AND 100 OR length(trim(p_area)) NOT BETWEEN 2 AND 160 OR length(trim(p_address)) NOT BETWEEN 2 AND 160 OR length(p_rules)>2000 OR length(trim(p_hours)) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION '400|INVALID_INPUT|Check the facility name, address, rules and hours.'; END IF;
 UPDATE app.facilities SET name=p_name,area=p_area,address=p_address,rules=p_rules,hours=p_hours WHERE id=p_id;
 RETURN jsonb_build_object('id',p_id);
END $$;
REVOKE ALL ON FUNCTION app.apply_operator(text,text,uuid),app.review_operator(uuid,boolean,text),app.open_support(uuid,text,text,uuid),app.reply_support(uuid,text,uuid,text),app.edit_facility(uuid,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.apply_operator(text,text,uuid),app.review_operator(uuid,boolean,text),app.open_support(uuid,text,text,uuid),app.reply_support(uuid,text,uuid,text),app.edit_facility(uuid,text,text,text,text,text) TO parkly_app;

CREATE FUNCTION app.operational_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
 IF NOT app.has_role('admin') THEN RAISE EXCEPTION '403|ADMIN_REQUIRED|Administrator access is required.'; END IF;
 RETURN jsonb_build_object('serverTime',clock_timestamp(),'workerLastSeen',app.notification_worker_status(),
 'failedPush',(SELECT count(*) FROM app.reminder_deliveries WHERE state='failed'),
 'sessionsPastDeadline',(SELECT count(*) FROM app.parking_sessions ps JOIN app.reservations r ON r.id=ps.reservation_id JOIN app.space_allocations a ON a.id=r.allocation_id WHERE ps.state='active' AND a.ends_at<=clock_timestamp()));
END $$;
REVOKE ALL ON FUNCTION app.operational_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.operational_status() TO parkly_app;
