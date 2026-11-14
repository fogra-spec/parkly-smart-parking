-- Keep applied migrations immutable: disambiguate JSON aliases from the
-- PL/pgSQL item variable. Allow the existing 500-space capacity limit to fit
-- a generated six-column floor without overflowing coordinate bounds.
ALTER TABLE app.floors DROP CONSTRAINT floors_layout_height_check;
ALTER TABLE app.floors ADD CHECK(layout_height BETWEEN 400 AND 30000);
ALTER TABLE app.spaces DROP CONSTRAINT spaces_y_check;
ALTER TABLE app.spaces ADD CHECK(y BETWEEN 0 AND 30000);
CREATE OR REPLACE FUNCTION app.save_floor_layout(p_floor uuid,p_version integer,p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,auth,pg_temp AS $$
DECLARE floor app.floors; item jsonb; n integer;
BEGIN
  SELECT * INTO floor FROM app.floors WHERE id=p_floor FOR UPDATE;
  IF NOT FOUND OR NOT app.can_manage(floor.facility_id) THEN RAISE EXCEPTION '403|FACILITY_ACCESS|Assigned facility access is required.'; END IF;
  IF floor.draft_version<>p_version THEN RAISE EXCEPTION '409|LAYOUT_CHANGED|The layout changed. Reload before saving.'; END IF;
  IF jsonb_typeof(p_document->'spaces')<>'array' OR jsonb_typeof(p_document->'features')<>'array'
    OR (p_document->>'width')::integer NOT BETWEEN 400 AND 10000 OR (p_document->>'height')::integer NOT BETWEEN 400 AND 30000
    OR jsonb_array_length(p_document->'features')>100 THEN RAISE EXCEPTION '400|INVALID_LAYOUT|Invalid floor dimensions or features.'; END IF;
  SELECT count(*) INTO n FROM app.spaces WHERE floor_id=p_floor;
  IF jsonb_array_length(p_document->'spaces')<>n OR
    (SELECT count(DISTINCT entry.value->>'id') FROM jsonb_array_elements(p_document->'spaces') AS entry(value))<>n THEN
    RAISE EXCEPTION '400|INVALID_LAYOUT|The draft must contain each floor space exactly once. Reload the floor.';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_document->'spaces') LOOP
    IF NOT EXISTS(SELECT 1 FROM app.spaces WHERE id=(item->>'id')::uuid AND floor_id=p_floor)
      OR length(trim(item->>'label')) NOT BETWEEN 1 AND 40
      OR (item->>'x')::integer NOT BETWEEN 0 AND 10000 OR (item->>'y')::integer NOT BETWEEN 0 AND 30000
      OR (item->>'width')::integer NOT BETWEEN 36 AND 240 OR (item->>'height')::integer NOT BETWEEN 48 AND 300
      OR (item->>'rotation')::integer NOT BETWEEN 0 AND 359 OR jsonb_typeof(item->'reservable')<>'boolean'
      THEN RAISE EXCEPTION '400|INVALID_LAYOUT|Invalid space coordinates or identity.'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT lower(trim(entry.value->>'label'))) FROM jsonb_array_elements(p_document->'spaces') AS entry(value))<>n THEN
    RAISE EXCEPTION '409|DUPLICATE_LABEL|Each space must have a unique label.';
  END IF;
  INSERT INTO app.floor_layout_drafts(floor_id,document,saved_by) VALUES(p_floor,p_document,app.uid())
    ON CONFLICT(floor_id) DO UPDATE SET document=excluded.document,saved_by=excluded.saved_by,saved_at=clock_timestamp();
  UPDATE app.floors SET draft_version=draft_version+1 WHERE id=p_floor;
  RETURN jsonb_build_object('version',p_version+1,'saved',true);
END $$;
