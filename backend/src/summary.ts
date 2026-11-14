import type { PoolClient } from 'pg';
export async function dashboardSummary(c: PoolClient) {
  const staff = (await c.query("SELECT app.has_role('admin') AS admin,app.has_role('operator') AS operator")).rows[0];
  const bookings = (await c.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE r.status='confirmed' AND a.starts_at<=clock_timestamp() AND a.ends_at>clock_timestamp())::int AS active,
    count(*) FILTER(WHERE r.status='confirmed' AND a.starts_at>clock_timestamp())::int AS upcoming,
    coalesce(sum(r.total_kzt) FILTER(WHERE r.status='completed'),0)::float8 AS "completedValue"
    FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id WHERE r.user_id=app.uid()`)).rows[0];
  const operations = staff.admin || staff.operator ? (await c.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE r.status='confirmed' AND a.starts_at<=clock_timestamp() AND a.ends_at>clock_timestamp())::int AS active,
    coalesce(sum(r.total_kzt) FILTER(WHERE r.status='completed'),0)::float8 AS "completedGmv"
    FROM app.reservations r JOIN app.space_allocations a ON a.id=r.allocation_id WHERE app.can_manage(r.facility_id)`)).rows[0] : null;
  const administration = staff.admin ? (await c.query(`SELECT
    (SELECT count(*)::int FROM app.profiles) AS users,
    (SELECT count(*)::int FROM app.operators WHERE active) AS operators,
    (SELECT count(*)::int FROM app.facilities WHERE NOT approved) AS "pendingFacilities",
    (SELECT count(*)::int FROM app.operator_applications WHERE status='pending') AS "pendingApplications",
    (SELECT count(*)::int FROM app.support_tickets WHERE status<>'resolved') AS "openCases"`)).rows[0] : null;
  return { bookings, operations, administration, basis: 'stored_reservations', payments: 'not_configured', serverNow: Date.now() };
}
