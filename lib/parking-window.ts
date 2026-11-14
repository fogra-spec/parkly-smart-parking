import { HOUR_MS, MAX_ADVANCE_MS } from './booking.ts';

export type ParkingWindow = { arrival: string; departure: string };

export function astanaInputTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const time = new Date(value + '+05:00').getTime();
  return Number.isFinite(time) && astanaInputValue(time) === value ? time : NaN;
}

export function astanaInputValue(time: number): string {
  return new Date(time + 5 * HOUR_MS).toISOString().slice(0, 16);
}

// Moving arrival moves the complete interval, keeping the driver's chosen
// duration even across midnight. Departure remains independently editable.
export function editParkingWindow(previous: ParkingWindow, field: keyof ParkingWindow, value: string): ParkingWindow {
  if (field === 'departure') return { ...previous, departure: value };
  const start = astanaInputTime(value);
  if (!Number.isFinite(start)) return { ...previous, arrival: value };
  const duration = astanaInputTime(previous.departure) - astanaInputTime(previous.arrival);
  const keep = Number.isFinite(duration) && duration >= HOUR_MS && duration <= 24 * HOUR_MS ? duration : 2 * HOUR_MS;
  return { arrival: value, departure: astanaInputValue(start + keep) };
}

export function parkingWindowError(window: ParkingWindow, now = Date.now()): string {
  const start = astanaInputTime(window.arrival), end = astanaInputTime(window.departure);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Enter a complete arrival and departure date and time.';
  if (start % HOUR_MS || end % HOUR_MS) return 'Choose whole-hour times, for example 12:00 or 13:00.';
  if (start < now) return 'Choose an arrival time in the future.';
  if (start > now + MAX_ADVANCE_MS) return 'Choose an arrival within the next 90 days.';
  if (end <= start) return 'Departure must be after arrival.';
  if (end - start > 24 * HOUR_MS) return 'Choose a reservation lasting 1–24 hours.';
  return '';
}
