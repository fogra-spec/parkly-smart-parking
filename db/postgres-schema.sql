-- Future PostgreSQL design. This file is a migration starting point, not a configured integration.
CREATE TABLE users (id text PRIMARY KEY, name text NOT NULL, role text NOT NULL CHECK(role IN ('driver','operator','admin')), active boolean NOT NULL DEFAULT true);
CREATE TABLE sessions (token uuid PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), expires bigint NOT NULL);
CREATE TABLE lots (id text PRIMARY KEY, owner text NOT NULL REFERENCES users(id), name text NOT NULL, area text NOT NULL, lat numeric(9,6) NOT NULL, lng numeric(9,6) NOT NULL, type text NOT NULL, price integer NOT NULL CHECK(price>=0), capacity integer NOT NULL CHECK(capacity>=0), approved boolean NOT NULL DEFAULT false);
CREATE TABLE bookings (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), lot_id text NOT NULL REFERENCES lots(id), start bigint NOT NULL, "end" bigint NOT NULL, total integer NOT NULL CHECK(total>=0), status text NOT NULL CHECK(status IN ('confirmed','completed','cancelled','operator_cancelled')), created bigint NOT NULL, CHECK("end">start));
CREATE INDEX bookings_capacity ON bookings(lot_id,status,start,"end");
CREATE TABLE favorites (id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),lot_id text NOT NULL REFERENCES lots(id),UNIQUE(user_id,lot_id));
-- Match the additive D1 foundation without inventing legacy agreed rates.
ALTER TABLE bookings ADD COLUMN idempotency_key uuid;
ALTER TABLE bookings ADD COLUMN hourly_price integer CHECK(hourly_price >= 0);
CREATE UNIQUE INDEX bookings_request_key ON bookings(user_id,idempotency_key);
CREATE INDEX bookings_user ON bookings(user_id,created);
CREATE INDEX lots_owner ON lots(owner);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE TABLE audit_events (id uuid PRIMARY KEY, actor_id text REFERENCES users(id), action text NOT NULL, target_id text NOT NULL, created bigint NOT NULL);
-- Store session-token digests rather than raw bearer tokens in a production
-- migration; the legacy `token uuid` definition above must be reviewed then.
-- Production booking transactions must SELECT the lot FOR UPDATE before checking overlap,
-- inserting a booking or changing capacity. A plain SELECT/count then INSERT is unsafe
-- under PostgreSQL READ COMMITTED. Allocate physical slots or use serializable retries
-- for higher utilization. D1's serialized atomic INSERT/SELECT is implemented in the demo.
