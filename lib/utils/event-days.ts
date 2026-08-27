// ─── Event day keys ─────────────────────────────────────────────────────────
// Every attendance day in VCC is a `yyyy-MM-dd` key in INDIA time, computed
// the same way no matter where the code runs.
//
// This used to rely on date-fns `format()`, which renders in the *runtime's*
// local timezone. That produced a split brain:
//   - the admin UI runs in the browser  → IST
//   - the API routes run on Vercel      → UTC
// so an event starting 27 Aug 04:00 IST (stored 2026-08-26T22:30Z) was day
// "2026-08-27" in the admin table and "2026-08-26" to the check-in endpoint.
// The same flaw made todayKey() return YESTERDAY on the server for any scan
// between 00:00 and 05:30 IST — exactly the window a midnight festival
// programme runs in.
//
// Everything below is pinned to Asia/Kolkata explicitly. India has a fixed
// +05:30 offset and observes no DST, so a constant shift is exact — no need
// for a timezone database.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** A Date's `yyyy-MM-dd` key as seen in India, regardless of server timezone. */
export function istDateKey(value: Date | string | number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // Shift the instant so that IST wall-clock time lands in the UTC fields,
  // then read the UTC fields — those are now the Indian calendar date.
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** All calendar days of an event as `yyyy-MM-dd` keys, IST, inclusive. */
export function eventDayKeys(
  start?: Date | string | null,
  end?: Date | string | null
): string[] {
  if (!start || !end) return [];
  const startKey = istDateKey(start);
  const endKey = istDateKey(end);
  if (!startKey || !endKey || endKey < startKey) return [];

  // Walk day by day from the IST start key. Stepping in UTC from a midday
  // anchor keeps the arithmetic immune to any offset rounding.
  const keys: string[] = [];
  const cursor = new Date(`${startKey}T12:00:00Z`);
  const last = new Date(`${endKey}T12:00:00Z`);
  while (cursor <= last) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/** Today as a `yyyy-MM-dd` key in IST. */
export function todayKey(): string {
  return istDateKey(new Date());
}

/**
 * Whether a `yyyy-MM-dd` key is later than today in IST.
 * Attendance can be recorded for today or backfilled for a past day, but never
 * for a day that has not happened yet. ISO keys compare lexicographically.
 */
export function isFutureDay(day: string): boolean {
  if (!day) return false;
  return day > todayKey();
}

/** Event days up to and including today — the days attendance may be marked for. */
export function markableDayKeys(
  start?: Date | string | null,
  end?: Date | string | null
): string[] {
  return eventDayKeys(start, end).filter((d) => !isFutureDay(d));
}

/**
 * Whether a `yyyy-MM-dd` key falls within an event's date range.
 * ISO date strings compare lexicographically = chronologically.
 */
export function dateInEventRange(
  date: string,
  start?: Date | string | null,
  end?: Date | string | null
): boolean {
  if (!date || !start || !end) return false;
  const startKey = istDateKey(start);
  const endKey = istDateKey(end);
  if (!startKey || !endKey) return false;
  return date >= startKey && date <= endKey;
}
