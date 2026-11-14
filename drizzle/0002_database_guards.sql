-- Schema-only guards preserve existing records; they validate future writes.
CREATE TRIGGER users_validate_insert BEFORE INSERT ON users
WHEN NEW.role NOT IN ('driver','operator','admin') OR NEW.active NOT IN (0,1) OR length(trim(NEW.name)) NOT BETWEEN 2 AND 60
BEGIN
  SELECT RAISE(ABORT, 'Invalid users record');
END;
--> statement-breakpoint
CREATE TRIGGER users_validate_update BEFORE UPDATE ON users
WHEN NEW.role NOT IN ('driver','operator','admin') OR NEW.active NOT IN (0,1) OR length(trim(NEW.name)) NOT BETWEEN 2 AND 60
BEGIN
  SELECT RAISE(ABORT, 'Invalid users record');
END;
--> statement-breakpoint
CREATE TRIGGER lots_validate_insert BEFORE INSERT ON lots
WHEN typeof(NEW.capacity)!='integer' OR NEW.capacity NOT BETWEEN 0 AND 10000 OR typeof(NEW.price)!='integer' OR NEW.price NOT BETWEEN 0 AND 100000 OR NEW.approved NOT IN (0,1) OR NEW.type NOT IN ('Covered','Outdoor') OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.owner AND role='operator')
BEGIN
  SELECT RAISE(ABORT, 'Invalid lots record');
END;
--> statement-breakpoint
CREATE TRIGGER lots_validate_update BEFORE UPDATE ON lots
WHEN typeof(NEW.capacity)!='integer' OR NEW.capacity NOT BETWEEN 0 AND 10000 OR typeof(NEW.price)!='integer' OR NEW.price NOT BETWEEN 0 AND 100000 OR NEW.approved NOT IN (0,1) OR NEW.type NOT IN ('Covered','Outdoor') OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.owner AND role='operator')
BEGIN
  SELECT RAISE(ABORT, 'Invalid lots record');
END;
--> statement-breakpoint
CREATE TRIGGER bookings_validate_insert BEFORE INSERT ON bookings
WHEN typeof(NEW.start)!='integer' OR typeof(NEW.end)!='integer' OR NEW.end<=NEW.start OR NEW.end-NEW.start>86400000 OR NEW.start%3600000!=0 OR NEW.end%3600000!=0 OR typeof(NEW.total)!='integer' OR NEW.total<0 OR NEW.status NOT IN ('confirmed','completed','cancelled','operator_cancelled') OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND role='driver') OR NOT EXISTS (SELECT 1 FROM lots WHERE id=NEW.lot_id)
BEGIN
  SELECT RAISE(ABORT, 'Invalid bookings record');
END;
--> statement-breakpoint
CREATE TRIGGER bookings_validate_update BEFORE UPDATE ON bookings
WHEN typeof(NEW.start)!='integer' OR typeof(NEW.end)!='integer' OR NEW.end<=NEW.start OR NEW.end-NEW.start>86400000 OR NEW.start%3600000!=0 OR NEW.end%3600000!=0 OR typeof(NEW.total)!='integer' OR NEW.total<0 OR NEW.status NOT IN ('confirmed','completed','cancelled','operator_cancelled') OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND role='driver') OR NOT EXISTS (SELECT 1 FROM lots WHERE id=NEW.lot_id)
BEGIN
  SELECT RAISE(ABORT, 'Invalid bookings record');
END;
--> statement-breakpoint
CREATE TRIGGER favorites_validate_insert BEFORE INSERT ON favorites
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id) OR NOT EXISTS (SELECT 1 FROM lots WHERE id=NEW.lot_id)
BEGIN
  SELECT RAISE(ABORT, 'Invalid favorites record');
END;
--> statement-breakpoint
CREATE TRIGGER favorites_validate_update BEFORE UPDATE ON favorites
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id) OR NOT EXISTS (SELECT 1 FROM lots WHERE id=NEW.lot_id)
BEGIN
  SELECT RAISE(ABORT, 'Invalid favorites record');
END;
--> statement-breakpoint
CREATE TRIGGER sessions_validate_insert BEFORE INSERT ON sessions
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id) OR typeof(NEW.expires)!='integer'
BEGIN
  SELECT RAISE(ABORT, 'Invalid sessions record');
END;
--> statement-breakpoint
CREATE TRIGGER sessions_validate_update BEFORE UPDATE ON sessions
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id) OR typeof(NEW.expires)!='integer'
BEGIN
  SELECT RAISE(ABORT, 'Invalid sessions record');
END;
--> statement-breakpoint
CREATE TRIGGER booking_terminal_status BEFORE UPDATE OF status ON bookings
WHEN OLD.status != 'confirmed' AND NEW.status != OLD.status
BEGIN
  SELECT RAISE(ABORT, 'Terminal booking status cannot change');
END;
--> statement-breakpoint
CREATE TRIGGER bookings_preserve_price BEFORE UPDATE OF total,hourly_price ON bookings
WHEN NEW.total != OLD.total OR NEW.hourly_price IS NOT OLD.hourly_price
BEGIN
  SELECT RAISE(ABORT, 'Agreed booking price is immutable');
END;
