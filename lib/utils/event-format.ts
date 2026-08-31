// ─── Event dates, for humans ────────────────────────────────────────────────
// Display-only companions to lib/utils/event-days.ts. That file decides which
// days an event HAS; this one decides how they read on screen. Keeping them in
// separate files keeps date-fns out of the API routes, which only need the
// logic.
//
// Two rules, both learned the hard way:
//
// 1. RENDER IN IST, ALWAYS. date-fns `format()` renders in whatever timezone
//    the browser happens to be in. The admin screens were fixed for this; the
//    volunteer-facing pages were not, so a devotee opening their seva card from
//    outside India — or on a phone whose timezone drifted — was shown a
//    different day from the one the check-in endpoint would accept.
//
// 2. A RANGE HAS TWO ENDS. The events list rendered the start date, then the
//    start and end TIMES beside it: an event running 4:46 PM on 4 Sep to
//    4:49 AM on 6 Sep displayed as "Sep 4, 2026 · 4:46 PM — 4:49 AM IST",
//    which reads as an event that finishes before it begins. The closing date
//    was simply dropped.
//
// Everything here derives its dates from eventDayKeys(), so what a screen shows
// and what attendance counts can never disagree — the "29–31 August" that was
// silently four attendance days would now read "29 Aug – 1 Sep · 4 days".

import { format } from "date-fns";
import { eventDayKeys, eventEndKey, eventStartKey, istWallClock } from "./event-days";

/** A `yyyy-MM-dd` key as a Date at local midnight — safe to `format()` anywhere. */
function dayKeyDate(key: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!parts) return null;
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
}

/** Format a `yyyy-MM-dd` event-day key. */
export function formatDayKey(key: string, pattern = "EEE, d MMM yyyy"): string {
  const d = dayKeyDate(key);
  return d ? format(d, pattern) : key || "—";
}

/**
 * Format a stored instant in INDIAN time, whatever timezone the browser is in.
 * This is the only way an instant should ever be rendered in this app.
 */
export function formatIst(
  value?: Date | string | null,
  pattern = "d MMM yyyy"
): string {
  const d = istWallClock(value);
  return d ? format(d, pattern) : "—";
}

/** `formatIst` with " IST" appended, for standalone timestamps. */
export function formatIstStamp(
  value?: Date | string | null,
  pattern = "d MMM yyyy, h:mm a"
): string {
  const text = formatIst(value, pattern);
  return text === "—" ? text : `${text} IST`;
}

/**
 * The event's calendar span, e.g.
 *   "Sat, 29 Aug 2026"        one day
 *   "29 – 31 Aug 2026"        within a month
 *   "29 Aug – 1 Sep 2026"     across months
 *
 * Derived from eventDayKeys, so it is exactly the set of days attendance can
 * be marked for — never the raw instants, which is how a closing time of
 * 00:30 used to display as an extra day.
 */
export function formatEventDateRange(
  start?: Date | string | null,
  end?: Date | string | null
): string {
  const days = eventDayKeys(start, end);
  if (days.length === 0) {
    return start ? formatIst(start, "EEE, d MMM yyyy") : "—";
  }

  const first = dayKeyDate(days[0]);
  const last = dayKeyDate(days[days.length - 1]);
  if (!first || !last) return "—";
  if (days.length === 1) return format(first, "EEE, d MMM yyyy");

  const sameYear = first.getFullYear() === last.getFullYear();
  const sameMonth = sameYear && first.getMonth() === last.getMonth();
  const left = sameMonth
    ? format(first, "d")
    : sameYear
      ? format(first, "d MMM")
      : format(first, "d MMM yyyy");
  return `${left} – ${format(last, "d MMM yyyy")}`;
}

/**
 * Opening and closing clock times, IST.
 *
 * Safe only next to the date range — on its own a multi-day event's
 * "4:46 PM – 4:49 AM" is the exact ambiguity this module exists to remove.
 * Use formatEventSpan() where the times stand alone.
 */
export function formatEventTimeRange(
  start?: Date | string | null,
  end?: Date | string | null
): string {
  if (!start || !end) return "—";
  return `${formatIst(start, "h:mm a")} – ${formatIst(end, "h:mm a")} IST`;
}

/**
 * A self-contained one-liner that can never read backwards, e.g.
 *   "1:00 AM – 11:50 PM IST"                        one day
 *   "29 Aug, 1:00 AM – 31 Aug, 11:00 PM IST"        several days
 */
export function formatEventSpan(
  start?: Date | string | null,
  end?: Date | string | null
): string {
  if (!start || !end) return "—";
  if (eventStartKey(start) === eventEndKey(end)) {
    return formatEventTimeRange(start, end);
  }
  return (
    `${formatIst(start, "d MMM, h:mm a")} – ` +
    `${formatIst(end, "d MMM, h:mm a")} IST`
  );
}

/** "3 days" / "1 day" / "" when there is no usable range. */
export function formatEventDayCount(
  start?: Date | string | null,
  end?: Date | string | null
): string {
  const count = eventDayKeys(start, end).length;
  if (count === 0) return "";
  return `${count} ${count === 1 ? "day" : "days"}`;
}
