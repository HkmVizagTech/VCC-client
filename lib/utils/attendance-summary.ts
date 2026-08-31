// ─── Overall attendance, derived ────────────────────────────────────────────
// `registration.status` is a LIFETIME flag: the moment a volunteer scans on any
// day it becomes "attended" and never changes back. That is fine as a workflow
// state and badly wrong as something to show an admin — a volunteer who came on
// the 29th and skipped the 30th and 31st still read "Attended" on the 31st, so
// the one column most people look at said the opposite of what happened.
//
// Attendance is per-day data (`registration.dayAttendance`), so the summary is
// derived from it here, in one place, and used by every screen that shows an
// overall figure. The stored status is only consulted for the states that are
// not about attendance at all (cancelled, assigned, registered).

import { eventDayKeys, markableDayKeys } from "./event-days";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface AttendanceDay {
  date: string;
  status: "attended" | "no_show";
}

export interface AttendanceSummary {
  /** Short text for the badge, e.g. "Attended 1/3". */
  label: string;
  variant: BadgeVariant;
  /** Full day-by-day breakdown, for the badge's tooltip. */
  title: string;
  attendedDays: string[];
  noShowDays: string[];
  /** Elapsed event days with no record either way. */
  unmarkedDays: string[];
  /** Every day of the event. */
  totalDays: number;
}

/** "2026-08-29" → "29 Aug". Used only in the tooltip. */
export function shortDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

export function summarizeAttendance(
  registration: {
    status: string;
    dayAttendance?: AttendanceDay[] | null;
  },
  eventStart?: Date | string | null,
  eventEnd?: Date | string | null
): AttendanceSummary {
  const days = eventDayKeys(eventStart, eventEnd);
  const elapsed = markableDayKeys(eventStart, eventEnd);
  const entries = registration.dayAttendance || [];

  // Only days that belong to the event count. A stray record from an earlier
  // date range (an event whose dates were edited after check-ins began) must
  // not inflate the numerator past the denominator.
  const inRange = (d: string) => days.includes(d);
  const attendedDays = entries
    .filter((e) => e.status === "attended" && inRange(e.date))
    .map((e) => e.date)
    .sort();
  const noShowDays = entries
    .filter((e) => e.status === "no_show" && inRange(e.date))
    .map((e) => e.date)
    .sort();
  const marked = new Set([...attendedDays, ...noShowDays]);
  const unmarkedDays = elapsed.filter((d) => !marked.has(d));

  const parts: string[] = [];
  if (attendedDays.length)
    parts.push(`Attended: ${attendedDays.map(shortDay).join(", ")}`);
  if (noShowDays.length)
    parts.push(`No show: ${noShowDays.map(shortDay).join(", ")}`);
  if (unmarkedDays.length)
    parts.push(`Not marked: ${unmarkedDays.map(shortDay).join(", ")}`);
  const upcoming = days.filter((d) => !elapsed.includes(d));
  if (upcoming.length)
    parts.push(`Upcoming: ${upcoming.map(shortDay).join(", ")}`);

  const base = {
    attendedDays,
    noShowDays,
    unmarkedDays,
    totalDays: days.length,
    title: parts.join(" · ") || "No attendance recorded yet",
  };

  if (registration.status === "cancelled") {
    return { ...base, label: "Cancelled", variant: "secondary" };
  }

  // No date range configured — nothing to count against, so fall back to the
  // stored status rather than showing a misleading "0/0".
  if (days.length === 0) {
    return {
      ...base,
      label: registration.status === "attended" ? "Attended" : "Registered",
      variant: registration.status === "attended" ? "default" : "outline",
    };
  }

  if (attendedDays.length > 0) {
    return {
      ...base,
      label: `Attended ${attendedDays.length}/${days.length}`,
      variant: "default",
    };
  }

  // Never showed up, and every day that has happened is accounted for as a
  // no-show. Only then is "No Show" the truth — mid-event it is still pending.
  if (noShowDays.length > 0 && unmarkedDays.length === 0) {
    return { ...base, label: `No Show 0/${days.length}`, variant: "destructive" };
  }

  return {
    ...base,
    label: registration.status === "assigned" ? "Assigned" : "Registered",
    variant: registration.status === "assigned" ? "secondary" : "outline",
  };
}
