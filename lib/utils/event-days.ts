import { eachDayOfInterval, format } from "date-fns";

/** All calendar days of an event as `yyyy-MM-dd` keys (inclusive). */
export function eventDayKeys(
  start?: Date | string | null,
  end?: Date | string | null
): string[] {
  if (!start || !end) return [];
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return [];
  }
  return eachDayOfInterval({ start: s, end: e }).map((d) =>
    format(d, "yyyy-MM-dd")
  );
}

/** Today as a `yyyy-MM-dd` key. */
export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
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
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  const startKey = format(s, "yyyy-MM-dd");
  const endKey = format(e, "yyyy-MM-dd");
  return date >= startKey && date <= endKey;
}
