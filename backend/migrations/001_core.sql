CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS auth;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA app, auth FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='parkly_app') THEN
    CREATE ROLE parkly_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA app, auth TO parkly_app;

CREATE TABLE app.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 60),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.user_roles (
  user_id uuid NOT NULL REFERENCES app.profiles(id), role text NOT NULL CHECK(role IN ('driver','operator','admin')),
  PRIMARY KEY(user_id,role)
);
CREATE TABLE auth.accounts (
  user_id uuid PRIMARY KEY REFERENCES app.profiles(id),
  email text NOT NULL UNIQUE CHECK(email=lower(trim(email)) AND length(email)<=254), password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE auth.sessions (
  token_hash text PRIMARY KEY CHECK(length(token_hash)=64), user_id uuid NOT NULL REFERENCES app.profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, CHECK(expires_at>created_at)
);
CREATE INDEX sessions_user ON auth.sessions(user_id);
CREATE INDEX sessions_expiry ON auth.sessions(expires_at) WHERE revoked_at IS NULL;
CREATE TABLE auth.rate_limits (
  key text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts>0)
);
CREATE TABLE app.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.operator_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operator_id uuid NOT NULL REFERENCES app.operators(id),
  user_id uuid NOT NULL REFERENCES app.profiles(id), active boolean NOT NULL DEFAULT true,
  UNIQUE(operator_id,user_id)
);
CREATE INDEX memberships_user ON app.operator_memberships(user_id) WHERE active;
CREATE TABLE app.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE,
  operator_id uuid NOT NULL REFERENCES app.operators(id), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
  area text NOT NULL CHECK(length(area) BETWEEN 2 AND 160), address text NOT NULL DEFAULT '',
  lat numeric(9,6) NOT NULL CHECK(lat BETWEEN -90 AND 90), lng numeric(9,6) NOT NULL CHECK(lng BETWEEN -180 AND 180),
  type text NOT NULL CHECK(type IN ('Covered','Outdoor')), approved boolean NOT NULL DEFAULT false,
  inventory_source text NOT NULL DEFAULT 'demo' CHECK(inventory_source IN ('demo','operator_updated','unavailable')),
  occupancy_source text NOT NULL DEFAULT 'not_available' CHECK(occupancy_source='not_available'),
  rules text NOT NULL DEFAULT 'Allocated reservation inventory. Physical occupancy is not verified.',
  hours text NOT NULL DEFAULT '24 hours', created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX facilities_operator ON app.facilities(operator_id);
CREATE TABLE app.floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), facility_id uuid NOT NULL REFERENCES app.facilities(id),
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 60), UNIQUE(facility_id,name), UNIQUE(id,facility_id)
);
CREATE TABLE app.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), facility_id uuid NOT NULL REFERENCES app.facilities(id),
  floor_id uuid NOT NULL, label text NOT NULL CHECK(length(label) BETWEEN 1 AND 40), active boolean NOT NULL DEFAULT true,
  FOREIGN KEY(floor_id,facility_id) REFERENCES app.floors(id,facility_id), UNIQUE(facility_id,label), UNIQUE(id,facility_id)
);
CREATE INDEX spaces_facility ON app.spaces(facility_id) WHERE active;
CREATE TABLE app.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), facility_id uuid NOT NULL REFERENCES app.facilities(id),
  version integer NOT NULL CHECK(version>0), hourly_kzt integer NOT NULL CHECK(hourly_kzt BETWEEN 0 AND 100000),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(facility_id,version)
);
CREATE UNIQUE INDEX pricing_one_active ON app.pricing_rules(facility_id) WHERE active;

-- All space claims share ONE exclusion constraint: holds, reservations and
-- maintenance blocks cannot race each other. Expiry is an explicit state write,
-- never a volatile now() expression in an index predicate.
CREATE TABLE app.space_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL, facility_id uuid NOT NULL,
  user_id uuid REFERENCES app.profiles(id), kind text NOT NULL CHECK(kind IN ('hold','reservation','maintenance')),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, released_at timestamptz,
  time_range tstzrange GENERATED ALWAYS AS (tstzrange(starts_at,ends_at,'[)')) STORED,
  FOREIGN KEY(space_id,facility_id) REFERENCES app.spaces(id,facility_id), CHECK(ends_at>starts_at),
  EXCLUDE USING gist (space_id WITH =, time_range WITH &&) WHERE (released_at IS NULL)
);
CREATE INDEX allocation_facility ON app.space_allocations(facility_id);
CREATE TABLE app.holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.profiles(id),
  allocation_id uuid NOT NULL UNIQUE REFERENCES app.space_allocations(id), request_key uuid NOT NULL,
  hourly_kzt integer NOT NULL CHECK(hourly_kzt>=0), total_kzt integer NOT NULL CHECK(total_kzt>=0),
  state text NOT NULL CHECK(state IN ('held','confirmed','cancelled','expired')), expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(user_id,request_key)
);
CREATE INDEX holds_expiry ON app.holds(expires_at) WHERE state='held';
CREATE TABLE app.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text NOT NULL UNIQUE DEFAULT ('PK-'||upper(gen_random_uuid()::text)),
  user_id uuid NOT NULL REFERENCES app.profiles(id), facility_id uuid NOT NULL REFERENCES app.facilities(id),
  hold_id uuid NOT NULL UNIQUE REFERENCES app.holds(id), allocation_id uuid NOT NULL UNIQUE REFERENCES app.space_allocations(id),
  hourly_kzt integer NOT NULL CHECK(hourly_kzt>=0), original_total_kzt integer NOT NULL CHECK(original_total_kzt>=0),
  total_kzt integer NOT NULL CHECK(total_kzt>=original_total_kzt),
  status text NOT NULL CHECK(status IN ('confirmed','cancelled','operator_cancelled','completed','expired')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX reservations_user ON app.reservations(user_id,created_at DESC);
CREATE INDEX reservations_facility ON app.reservations(facility_id,status);
CREATE TABLE app.maintenance_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), allocation_id uuid NOT NULL UNIQUE REFERENCES app.space_allocations(id),
  facility_id uuid NOT NULL REFERENCES app.facilities(id), reason text NOT NULL CHECK(length(reason) BETWEEN 2 AND 240),
  created_by uuid NOT NULL REFERENCES app.profiles(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.reservation_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid NOT NULL REFERENCES app.reservations(id),
  old_end timestamptz NOT NULL, new_end timestamptz NOT NULL CHECK(new_end>old_end),
  added_kzt integer NOT NULL CHECK(added_kzt>=0), request_key uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES app.profiles(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(created_by,request_key)
);
CREATE TABLE app.parking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid NOT NULL UNIQUE REFERENCES app.reservations(id),
  user_id uuid NOT NULL REFERENCES app.profiles(id), facility_id uuid NOT NULL REFERENCES app.facilities(id),
  state text NOT NULL CHECK(state IN ('active','ended')), checked_in_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  checked_out_at timestamptz, source text NOT NULL DEFAULT 'operator_recorded' CHECK(source='operator_recorded'),
  CHECK((state='active' AND checked_out_at IS NULL) OR (state='ended' AND checked_out_at>=checked_in_at))
);
CREATE INDEX parking_sessions_user ON app.parking_sessions(user_id,checked_in_at DESC);
CREATE TABLE app.booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id uuid REFERENCES app.reservations(id),
  hold_id uuid REFERENCES app.holds(id), from_status text, to_status text NOT NULL,
  actor_id uuid REFERENCES app.profiles(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(num_nonnulls(reservation_id,hold_id)=1)
);
CREATE INDEX history_reservation ON app.booking_status_history(reservation_id,created_at);
CREATE TABLE app.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES app.profiles(id), in_app boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.profiles(id),
  endpoint text NOT NULL UNIQUE CHECK(endpoint LIKE 'https://%' AND length(endpoint)<2048),
  p256dh text NOT NULL, auth_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.profiles(id),
  reservation_id uuid REFERENCES app.reservations(id), event text NOT NULL, channel text NOT NULL CHECK(channel IN ('in_app','push')),
  status text NOT NULL CHECK(status IN ('recorded','not_configured','pending','failed','delivered')),
  attempts integer NOT NULL DEFAULT 0, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notifications_user ON app.notification_deliveries(user_id,created_at DESC);
CREATE TABLE app.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES app.profiles(id),
  action text NOT NULL, target_id text NOT NULL, facility_id uuid REFERENCES app.facilities(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audit_created ON app.audit_logs(created_at DESC);
CREATE INDEX audit_facility ON app.audit_logs(facility_id,created_at DESC);
CREATE TABLE app.action_requests (
  user_id uuid NOT NULL REFERENCES app.profiles(id), request_key uuid NOT NULL, kind text NOT NULL,
  target_id uuid NOT NULL, payload jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_key)
);
CREATE TABLE app.favorites (
  user_id uuid NOT NULL REFERENCES app.profiles(id), facility_id uuid NOT NULL REFERENCES app.facilities(id),
  PRIMARY KEY(user_id,facility_id)
);
