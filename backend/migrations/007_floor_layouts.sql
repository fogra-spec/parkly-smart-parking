ALTER TABLE app.floors ADD COLUMN layout_width integer NOT NULL DEFAULT 800 CHECK(layout_width BETWEEN 400 AND 10000);
ALTER TABLE app.floors ADD COLUMN layout_height integer NOT NULL DEFAULT 700 CHECK(layout_height BETWEEN 400 AND 20000);
ALTER TABLE app.floors ADD COLUMN features jsonb NOT NULL DEFAULT '[{"id":"entrance","kind":"entrance","label":"Entrance","x":30,"y":30,"width":120,"height":40},{"id":"lane","kind":"driveway","label":"Driveway →","x":30,"y":295,"width":740,"height":55},{"id":"exit","kind":"exit","label":"Exit →","x":650,"y":630,"width":120,"height":40}]';
ALTER TABLE app.floors ADD COLUMN published_version integer NOT NULL DEFAULT 1;
ALTER TABLE app.floors ADD COLUMN draft_version integer NOT NULL DEFAULT 0;
ALTER TABLE app.spaces ADD COLUMN x integer NOT NULL DEFAULT 60 CHECK(x BETWEEN 0 AND 10000);
ALTER TABLE app.spaces ADD COLUMN y integer NOT NULL DEFAULT 100 CHECK(y BETWEEN 0 AND 20000);
ALTER TABLE app.spaces ADD COLUMN width integer NOT NULL DEFAULT 90 CHECK(width BETWEEN 36 AND 240);
ALTER TABLE app.spaces ADD COLUMN height integer NOT NULL DEFAULT 150 CHECK(height BETWEEN 48 AND 300);
ALTER TABLE app.spaces ADD COLUMN rotation integer NOT NULL DEFAULT 0 CHECK(rotation BETWEEN 0 AND 359);
ALTER TABLE app.spaces ADD COLUMN reservable boolean NOT NULL DEFAULT true;
ALTER TABLE app.spaces ADD COLUMN map_published boolean NOT NULL DEFAULT true;
WITH ranked AS(SELECT id,row_number() OVER(PARTITION BY floor_id ORDER BY label)-1 AS n FROM app.spaces)
UPDATE app.spaces s SET x=60+(n%6)*115,y=100+(n/6)*260 FROM ranked r WHERE s.id=r.id;
UPDATE app.floors f SET layout_height=greatest(700,coalesce((SELECT max(y+height+80) FROM app.spaces WHERE floor_id=f.id),700));
CREATE FUNCTION app.place_new_space() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM app.spaces WHERE floor_id=NEW.floor_id;
  NEW.x:=60+(n%6)*115;NEW.y:=100+(n/6)*260;
  UPDATE app.floors SET layout_height=greatest(layout_height,NEW.y+NEW.height+80) WHERE id=NEW.floor_id;
  RETURN NEW;
END $$;
CREATE TRIGGER space_position BEFORE INSERT ON app.spaces FOR EACH ROW EXECUTE FUNCTION app.place_new_space();
CREATE TABLE app.floor_layout_drafts(
  floor_id uuid PRIMARY KEY REFERENCES app.floors(id),document jsonb NOT NULL,
  saved_by uuid NOT NULL REFERENCES app.profiles(id),saved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE app.floor_layout_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY floor_draft_read ON app.floor_layout_drafts FOR SELECT TO parkly_app USING(
  EXISTS(SELECT 1 FROM app.floors f WHERE f.id=floor_id AND app.can_manage(f.facility_id)));
GRANT SELECT ON app.floor_layout_drafts TO parkly_app;
CREATE TRIGGER layout_audit AFTER INSERT OR UPDATE ON app.floor_layout_drafts FOR EACH ROW EXECUTE FUNCTION app.log_record_change();

CREATE FUNCTION app.save_floor_layout(p_floor uuid,p_version integer,p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE floor app.floors; item jsonb; n integer;
BEGIN
  SELECT * INTO floor FROM app.floors WHERE id=p_floor FOR UPDATE;
  IF NOT FOUND OR NOT app.can_manage(floor.facility_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Assigned facility access is required.'; END IF;
  IF floor.draft_version<>p_version THEN RAISE EXCEPTION '409|LAYOUT_CHANGED|The layout changed. Reload before saving.'; END IF;
  IF jsonb_typeof(p_document->'spaces')<>'array' OR jsonb_typeof(p_document->'features')<>'array'
    OR (p_document->>'width')::integer NOT BETWEEN 400 AND 10000 OR (p_document->>'height')::integer NOT BETWEEN 400 AND 20000
    OR jsonb_array_length(p_document->'features')>100 THEN RAISE EXCEPTION '400|INVALID_LAYOUT|Invalid floor dimensions or features.'; END IF;
  SELECT count(*) INTO n FROM app.spaces WHERE floor_id=p_floor;
  IF jsonb_array_length(p_document->'spaces')<>n OR
    (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(p_document->'spaces') item)<>n THEN
    RAISE EXCEPTION '400|INVALID_LAYOUT|The draft must contain each floor space exactly once. Reload the floor.';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_document->'spaces') LOOP
    IF NOT EXISTS(SELECT 1 FROM app.spaces WHERE id=(item->>'id')::uuid AND floor_id=p_floor)
      OR length(trim(item->>'label')) NOT BETWEEN 1 AND 40
      OR (item->>'x')::integer NOT BETWEEN 0 AND 10000 OR (item->>'y')::integer NOT BETWEEN 0 AND 20000
      OR (item->>'width')::integer NOT BETWEEN 36 AND 240 OR (item->>'height')::integer NOT BETWEEN 48 AND 300
      OR (item->>'rotation')::integer NOT BETWEEN 0 AND 359 OR jsonb_typeof(item->'reservable')<>'boolean'
      THEN RAISE EXCEPTION '400|INVALID_LAYOUT|Invalid space coordinates or identity.'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT lower(trim(item->>'label'))) FROM jsonb_array_elements(p_document->'spaces') item)<>n THEN
    RAISE EXCEPTION '409|DUPLICATE_LABEL|Each space must have a unique label.';
  END IF;
  INSERT INTO app.floor_layout_drafts(floor_id,document,saved_by) VALUES(p_floor,p_document,app.uid())
    ON CONFLICT(floor_id) DO UPDATE SET document=excluded.document,saved_by=excluded.saved_by,saved_at=clock_timestamp();
  UPDATE app.floors SET draft_version=draft_version+1 WHERE id=p_floor;
  RETURN jsonb_build_object('version',p_version+1,'saved',true);
END $$;
CREATE FUNCTION app.publish_floor_layout(p_floor uuid,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE floor app.floors; doc jsonb; item jsonb;
BEGIN
  SELECT * INTO floor FROM app.floors WHERE id=p_floor FOR UPDATE;
  IF NOT FOUND OR NOT app.can_manage(floor.facility_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Assigned facility access is required.'; END IF;
  IF floor.draft_version<>p_version THEN RAISE EXCEPTION '409|LAYOUT_CHANGED|A newer draft exists. Reload before publishing.'; END IF;
  SELECT document INTO doc FROM app.floor_layout_drafts WHERE floor_id=p_floor;
  IF doc IS NULL THEN RAISE EXCEPTION '409|NO_DRAFT|Save a draft before publishing.'; END IF;
  -- Lock every space before changing reservability. Existing agreements remain valid.
  PERFORM 1 FROM app.spaces WHERE floor_id=p_floor ORDER BY id FOR UPDATE;
  IF jsonb_array_length(doc->'spaces')<>(SELECT count(*) FROM app.spaces WHERE floor_id=p_floor) THEN
    RAISE EXCEPTION '409|LAYOUT_CHANGED|Inventory changed. Reload and save a new draft.';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(doc->'spaces') LOOP
    UPDATE app.spaces SET label=trim(item->>'label'),x=(item->>'x')::integer,y=(item->>'y')::integer,
      width=(item->>'width')::integer,height=(item->>'height')::integer,rotation=(item->>'rotation')::integer,
      reservable=(item->>'reservable')::boolean,map_published=true WHERE id=(item->>'id')::uuid AND floor_id=p_floor;
  END LOOP;
  UPDATE app.floors SET layout_width=(doc->>'width')::integer,layout_height=(doc->>'height')::integer,
    features=doc->'features',published_version=published_version+1 WHERE id=p_floor;
  RETURN jsonb_build_object('published',true,'version',floor.published_version+1);
END $$;
CREATE FUNCTION app.add_draft_space(p_floor uuid,p_label text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE floor app.floors; identity uuid;
BEGIN
  SELECT * INTO floor FROM app.floors WHERE id=p_floor FOR UPDATE;
  IF NOT FOUND OR NOT app.can_manage(floor.facility_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Assigned facility access is required.'; END IF;
  identity:=app.add_space(floor.facility_id,p_floor,p_label);
  UPDATE app.spaces SET reservable=false,map_published=false WHERE id=identity;
  -- Force editors to reload/reconcile; a new space cannot be booked before publication.
  UPDATE app.floors SET draft_version=draft_version+1 WHERE id=p_floor;
  RETURN identity;
END $$;

-- Preserve the original checked booking implementation and add a serialized
-- per-driver limit plus published/reservable inventory gate at the same lock boundary.
ALTER FUNCTION app.hold_space(uuid,timestamptz,timestamptz,integer,uuid) RENAME TO hold_space_v1;
REVOKE EXECUTE ON FUNCTION app.hold_space_v1(uuid,timestamptz,timestamptz,integer,uuid) FROM parkly_app,PUBLIC;
CREATE FUNCTION app.hold_space(p_space uuid,p_start timestamptz,p_end timestamptz,p_quote integer,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  IF NOT app.has_role('driver') THEN RAISE EXCEPTION '403|DRIVER_REQUIRED|Driver access is required.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('driver-holds:'||app.uid()::text,0));
  IF NOT EXISTS(SELECT 1 FROM app.holds WHERE user_id=app.uid() AND request_key=p_key) THEN
    PERFORM 1 FROM app.spaces WHERE id=p_space FOR UPDATE;
    IF NOT EXISTS(SELECT 1 FROM app.spaces WHERE id=p_space AND active AND reservable AND map_published) THEN
      RAISE EXCEPTION '409|SPACE_UNAVAILABLE|This space is not published as reservable inventory.';
    END IF;
  END IF;
  RETURN app.hold_space_v1(p_space,p_start,p_end,p_quote,p_key);
END $$;
ALTER FUNCTION app.available_spaces(uuid,timestamptz,timestamptz) RENAME TO available_spaces_v1;
REVOKE EXECUTE ON FUNCTION app.available_spaces_v1(uuid,timestamptz,timestamptz) FROM parkly_app,PUBLIC;
CREATE FUNCTION app.available_spaces(p_facility uuid,p_start timestamptz,p_end timestamptz)
RETURNS TABLE(id uuid,label text,floor_name text,available boolean,active boolean,floor_id uuid,x integer,y integer,width integer,height integer,rotation integer,reservable boolean,availability_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
BEGIN
  RETURN QUERY SELECT s.id,s.label,a.floor_name,a.available AND s.reservable AND s.map_published,s.active,s.floor_id,s.x,s.y,s.width,s.height,s.rotation,s.reservable,
    CASE WHEN NOT s.active OR NOT s.reservable OR NOT s.map_published THEN 'unavailable'
      WHEN EXISTS(SELECT 1 FROM app.space_allocations claim WHERE claim.space_id=s.id AND claim.released_at IS NULL AND claim.kind='hold' AND claim.time_range&&tstzrange(p_start,p_end,'[)')) THEN 'held'
      WHEN a.available THEN 'available' ELSE 'unavailable' END
    FROM app.available_spaces_v1(p_facility,p_start,p_end) a JOIN app.spaces s ON s.id=a.id
    WHERE s.map_published OR app.can_manage(p_facility);
END $$;
REVOKE ALL ON FUNCTION app.place_new_space(),app.save_floor_layout(uuid,integer,jsonb),app.publish_floor_layout(uuid,integer),app.add_draft_space(uuid,text),app.hold_space(uuid,timestamptz,timestamptz,integer,uuid),app.available_spaces(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.save_floor_layout(uuid,integer,jsonb),app.publish_floor_layout(uuid,integer),app.add_draft_space(uuid,text),app.hold_space(uuid,timestamptz,timestamptz,integer,uuid),app.available_spaces(uuid,timestamptz,timestamptz) TO parkly_app;
