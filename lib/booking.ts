export const HOUR_MS = 3_600_000;
export const MAX_ADVANCE_MS = 90 * 24 * HOUR_MS;

/** Half-open intervals [start, end): an ending reservation releases its slot. */
export function validateBookingWindow(start: number, end: number, now = Date.now()): void {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < now || start > now + MAX_ADVANCE_MS ||
      start % HOUR_MS !== 0 || end % HOUR_MS !== 0 ||
      end - start < HOUR_MS || end - start > 24 * HOUR_MS) {
    throw new Error('Book whole-hour slots, 1–24 hours, within the next 90 days.');
  }
}

/** Calendar input uses the business timezone, never the device timezone. */
export function nextAstanaHour(now = Date.now()): string {
  const rounded = (Math.floor(now / HOUR_MS) + 1) * HOUR_MS;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(rounded);
  const value = (name: string) => parts.find(p => p.type === name)?.value;
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

export function businessPath(hash: string): string {
  const page = hash.replace(/^#\/?/, '').split('?')[0];
  return ['home', 'map', 'driver', 'operator', 'admin', 'finance', 'help'].includes(page) ? page : 'home';
}
