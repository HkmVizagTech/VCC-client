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
//
// ─── The 1am day boundary ───────────────────────────────────────────────────
// An event day does NOT end at midnight. A festival programme runs past
// midnight, and a volunteer scanning at 00:30 is finishing the day that began
// the previous morning — not starting a new one they aren't rostered for. So
// the day rolls over at 01:00 IST: every instant between 00:00 and 01:00 IST
// belongs to the previous day's key.
//
// This is the same boundary the daily-seva-sync cron runs on (01:00 IST), so
// the day is settled and pushed at the moment it ends.
//
// It also makes the event form's defaults land exactly right: an event created
// as 01:00 on the opening day through 23:00 on the closing day produces
// exactly one key per calendar day, with no phantom day at either end.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/**
 * The hour (IST) at which one event day becomes the next. Deliberately a
 * hardcoded constant rather than an env var: the browser and the server MUST
 * agree on it, and a value set in one place but not the other would put the
 * admin screen and the check-in endpoint on different days — exactly the class
 * of bug the IST pinning above was written to kill.
 */
export const DAY_START_HOUR_IST = 1;
const DAY_START_OFFSET_MS = DAY_START_HOUR_IST * 60 * 60 * 1000;

/**
 * The event-day key an instant belongs to, in IST, honouring the 1am boundary.
 * 00:30 IST on the 28th is still day "…-27".
 */
export function istDateKey(value: Date | string | number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // Shift the instant so IST wall-clock time lands in the UTC fields, wind
  // back to the day boundary, then read the UTC fields — those are now the
  // Indian event-day date.
  return new Date(d.getTime() + IST_OFFSET_MS - DAY_START_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * The IST calendar date of an instant, ignoring the 1am boundary.
 * For displaying a wall-clock date only — anything deciding which event day
 * something counts towards must use istDateKey().
 */
export function istCalendarKey(value: Date | string | number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// ─── The two ends of an event are not symmetric ─────────────────────────────
// The 1am boundary exists so a volunteer scanning at 00:30 is credited to the
// day that began the previous morning. That is exactly right for an event's
// END: a programme finishing at 00:30 on 1 Sep is the closing night of the
// 31st, and must not manufacture a 1 Sep day nobody is rostered for.
//
// It is exactly wrong for an event's START. A date picker hands back 00:00, and
// an admin who sets the opening day to 29 Aug means the 29th — but 00:00 IST
// falls before the 01:00 boundary, so the boundary rule would call it the 28th
// and prepend a phantom opening day nobody can ever attend. The start is
// therefore read as a plain IST calendar date.
//
// (The event form defaults a picked date to 01:00, which sidesteps this. These
// two helpers make it impossible rather than merely unlikely — including for
// events created before that default existed, and for times typed by hand.)

/** The `yyyy-MM-dd` opening day of an event, IST. */
export function eventStartKey(start?: Date | string | null): string {
  return start ? istCalendarKey(start) : "";
}

/** The `yyyy-MM-dd` closing day of an event, IST, honouring the 1am boundary. */
export function eventEndKey(end?: Date | string | null): string {
  return end ? istDateKey(end) : "";
}

/** All calendar days of an event as `yyyy-MM-dd` keys, IST, inclusive. */
export function eventDayKeys(
  start?: Date | string | null,
  end?: Date | string | null
): string[] {
  if (!start || !end) return [];
  const startKey = eventStartKey(start);
  const endKey = eventEndKey(end);
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

/** Today as a `yyyy-MM-dd` event-day key in IST (rolls over at 01:00). */
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
  // Same asymmetry as eventDayKeys — this must accept exactly the days that
  // list contains, or the admin screen offers a day the API then rejects.
  const startKey = eventStartKey(start);
  const endKey = eventEndKey(end);
  if (!startKey || !endKey) return false;
  return date >= startKey && date <= endKey;
}

/**
 * Milliseconds from now until the next 01:00 IST rollover.
 * The attendance screen uses this to re-arm a timer, so a tab left open
 * overnight moves to the new day on its own instead of showing yesterday.
 */
export function msUntilNextDayBoundary(from: Date = new Date()): number {
  const shifted = from.getTime() + IST_OFFSET_MS - DAY_START_OFFSET_MS;
  const sinceBoundary = ((shifted % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - sinceBoundary;
}

// ─── datetime-local ⇄ stored instant ────────────────────────────────────────
// The event form uses <input type="datetime-local">, which produces offset-less
// strings like "2026-08-30T23:00". Those are ambiguous: a browser reads them as
// local time (IST here), Vercel's Node reads them as UTC. Saving one therefore
// stored a time 5h30m later than the admin typed — a 23:00 close became 04:30
// the next morning, which manufactured an extra event day in attendance, in the
// availability editor, and in the cron's range check. Re-saving an event shifted
// it again, every time.
//
// These two helpers are the fix: the form renders with dateToIstInput() and the
// API parses with parseIstInput(), so an offset-less string means India time on
// both sides of the wire.

/**
 * A Date whose LOCAL fields equal the instant's IST wall clock.
 *
 * Pass it to date-fns format() to render Indian time in any browser, wherever
 * the coordinator happens to be. Never do arithmetic with the result — it is a
 * display shim, not a real instant.
 */
export function istWallClock(value?: Date | string | number | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds()
  );
}

/** A stored instant as a `yyyy-MM-ddTHH:mm` value for <input type="datetime-local">, in IST. */
export function dateToIstInput(value?: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * Parse a datetime value that may or may not carry a timezone.
 * A bare `yyyy-MM-ddTHH:mm` (what datetime-local submits) is read as IST;
 * anything already carrying `Z` or an explicit offset is left alone, so
 * existing API clients that send proper ISO strings are unaffected.
 * Returns null for empty or unparseable input.
 */
export function parseIstInput(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  const bare = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?(\.\d+)?$/.exec(raw);
  const d = bare
    ? new Date(`${bare[1]}T${bare[2]}${bare[3] || ":00"}${bare[4] || ".000"}+05:30`)
    : new Date(raw);

  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalizes the datetime fields on an event payload in place-safe fashion.
 * Only touches keys that are actually present, so a PATCH-style partial update
 * keeps working, and leaves a field alone if it cannot be parsed (the schema's
 * own required/cast validation then reports it).
 */
export const EVENT_DATE_FIELDS = [
  "eventStart",
  "eventEnd",
  "registrationStart",
  "registrationEnd",
] as const;

export function normalizeEventDates<T extends Record<string, unknown>>(body: T): T {
  const out: Record<string, unknown> = { ...body };
  for (const field of EVENT_DATE_FIELDS) {
    if (!(field in out)) continue;
    const value = out[field];
    if (value === null || value === "") continue;
    const parsed = parseIstInput(value as string | Date);
    if (parsed) out[field] = parsed;
  }
  return out as T;
}
