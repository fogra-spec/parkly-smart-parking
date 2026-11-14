/**
 * Internal SQL fragments only; arguments below are identifiers owned by this
 * module, never request values. User data is always passed through bindings.
 * Demand can only increase at the requested start or another booking's start.
 * Counting at those points gives exact peak demand, rather than counting every
 * reservation that touches any part of the requested interval.
 */
const peak = (lot: string, start: string, end: string) => `(
  SELECT COALESCE(MAX((
    SELECT COUNT(*) FROM bookings active
    WHERE active.lot_id = ${lot} AND active.status = 'confirmed'
      AND active.start <= points.t AND active.end > points.t
  )), 0)
  FROM (
    SELECT ${start} AS t
    UNION SELECT other.start FROM bookings other
      WHERE other.lot_id = ${lot} AND other.status = 'confirmed'
        AND other.start > ${start} AND other.start < ${end}
  ) points
)`;

export const availabilitySql = `
  WITH window AS (SELECT ? AS start, ? AS end)
  SELECT MAX(0, l.capacity - ${peak('l.id', 'window.start', 'window.end')}) AS available
  FROM lots l, window WHERE l.id = ? AND l.approved = 1`;

export const createBookingSql = `
  WITH candidate AS (SELECT ? AS id, ? AS user_id, ? AS lot_id, ? AS start,
    ? AS end, ? AS created, ? AS request_key, ? AS quoted_price)
  INSERT INTO bookings
    (id, user_id, lot_id, start, end, total, status, created, idempotency_key, hourly_price)
  SELECT c.id, c.user_id, l.id, c.start, c.end,
    l.price * ((c.end - c.start) / 3600000), 'confirmed', c.created, c.request_key, l.price
  FROM candidate c JOIN lots l ON l.id = c.lot_id
  WHERE l.approved = 1
    AND (c.quoted_price IS NULL OR c.quoted_price = l.price)
    AND EXISTS (SELECT 1 FROM users WHERE id = c.user_id AND role = 'driver' AND active = 1)
    AND (c.request_key IS NULL OR NOT EXISTS (
      SELECT 1 FROM bookings WHERE user_id = c.user_id AND idempotency_key = c.request_key))
    AND ${peak('l.id', 'c.start', 'c.end')} < l.capacity`;

export const updateInventorySql = `
  WITH limits AS (SELECT ? AS now, ? AS capacity, ? AS price, ? AS owner)
  UPDATE lots SET capacity = (SELECT capacity FROM limits), price = (SELECT price FROM limits)
  WHERE id = ? AND owner = (SELECT owner FROM limits)
    AND EXISTS (SELECT 1 FROM users WHERE id = lots.owner AND role = 'operator' AND active = 1)
    AND (SELECT capacity FROM limits) >= ${peak('lots.id', '(SELECT now FROM limits)', '9007199254740991')}`;
