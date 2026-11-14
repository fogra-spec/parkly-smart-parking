import type { PoolClient } from 'pg';
import { dashboardSummary } from './summary.ts';

export const bookingQuery = `SELECT r.id,r.reference,r.user_id,r.facility_id AS lot_id,f.name,
  (extract(epoch FROM a.starts_at)*1000)::float8 AS start,(extract(epoch FROM a.ends_at)*1000)::float8 AS "end",
  r.total_kzt AS total,r.hourly_kzt AS hourly_price,r.status,(extract(epoch FROM r.created_at)*1000)::float8 AS created,
  s.label AS space_label,a.space_id,fl.name AS floor_name,f.address,ps.id AS session_id,ps.state AS session_state
  FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id
  JOIN app.facilities f ON f.id=r.facility_id JOIN app.spaces s ON s.id=a.space_id
  JOIN app.floors fl ON fl.id=s.floor_id
  LEFT JOIN app.parking_sessions ps ON ps.reservation_id=r.id`;

export async function state(client: PoolClient) {
  await client.query('SELECT app.expire_due()');
  const user = (await client.query(`SELECT id,name,active::int AS active,
    (SELECT array_agg(role ORDER BY role) FROM app.user_roles WHERE user_id=app.profiles.id) AS roles,
    CASE WHEN app.has_role('admin') THEN 'admin' WHEN app.has_role('operator') THEN 'operator' ELSE 'driver' END AS role
    FROM app.profiles WHERE id=app.uid()`)).rows[0] || null;
  const lots = (await client.query(`SELECT f.id,f.code,f.operator_id AS owner,f.name,f.area,f.address,
    f.lat::text,f.lng::text,f.type,f.approved::int AS approved,f.inventory_source,f.occupancy_source,f.rules,f.hours,
    app.is_member(f.operator_id) AS managed,coalesce(p.hourly_kzt,0) AS price,
    (SELECT count(*)::int FROM app.spaces s WHERE s.facility_id=f.id AND s.active) AS capacity,
    (SELECT count(*)::int FROM app.spaces s WHERE s.facility_id=f.id AND s.active AND s.reservable AND s.map_published) AS bookable_capacity,
    (SELECT count(*)::int FROM app.space_allocations a WHERE a.facility_id=f.id AND a.kind='reservation' AND a.released_at IS NULL AND a.time_range @> clock_timestamp()) AS reserved_now,
    (SELECT count(*)::int FROM app.available_spaces(f.id,clock_timestamp(),clock_timestamp()+interval '1 second') s WHERE s.available) AS available
    FROM app.facilities f LEFT JOIN app.pricing_rules p ON p.facility_id=f.id AND p.active ORDER BY f.code NULLS LAST,f.name`)).rows;
  const bookings = user ? (await client.query(bookingQuery + ' ORDER BY r.created_at DESC LIMIT 200')).rows : [];
  const users = user?.role === 'admin' ? (await client.query(`SELECT p.id,p.name,p.active::int AS active,
    CASE WHEN EXISTS(SELECT 1 FROM app.user_roles WHERE user_id=p.id AND role='admin') THEN 'admin'
      WHEN EXISTS(SELECT 1 FROM app.user_roles WHERE user_id=p.id AND role='operator') THEN 'operator' ELSE 'driver' END AS role
    FROM app.profiles p ORDER BY p.created_at LIMIT 200`)).rows : [];
  const favorites = user ? (await client.query('SELECT facility_id AS lot_id FROM app.favorites')).rows : [];
  return { user, lots, bookings, users, favorites, summary:user?await dashboardSummary(client):null, auth: { mode: 'password', signInPath: '', signOutPath: '' },
    backend: { database: 'postgresql', reservationInventory: true, physicalOccupancy: 'not_available', payments: 'not_configured' } };
}
