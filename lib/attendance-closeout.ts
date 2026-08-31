// ─── Nightly attendance close-out ───────────────────────────────────────────
// A day that has come and gone with no scan is not "pending" — it is a no-show.
// Nothing used to say so. VCC recorded a day only when somebody acted on it, so
// a volunteer who signed up for the 29th, 30th and 31st and scanned only on the
// 29th left the 30th and 31st blank forever: blank in the attendance table,
// blank in the reports, and — worse — nothing was ever sent to the community
// app, so their side had no record of the absence either.
//
// This runs from the 01:00 IST cron, the same boundary `todayKey()` rolls on,
// so a day is settled the moment it ends. For each event day now in the past it
// writes a `no_show` entry (source "auto") for every volunteer who was rostered
// that day and has no entry of their own, and hands back the pushes the caller
// should send so the community app hears about them too.
//
// Deliberate properties:
//   - Idempotent. A day that already has an entry — from a QR scan, an admin,
//     or a previous run — is never touched, so re-running the cron changes
//     nothing and cannot overwrite a real check-in.
//   - Never touches today. The day is still running; volunteers are still
//     arriving. Only days strictly before `todayKey()` are settled.
//   - Never touches a cancelled registration.

import type { Types } from "mongoose";
import { Registration } from "@/lib/models";
import { eventDayKeys, todayKey } from "@/lib/utils/event-days";

export type PendingPush = {
  registrationId: string;
  date: string;
};

export type CloseOutResult = {
  /** Event days that were in the past at this run. */
  days: string[];
  /** How many registrations got at least one new no-show entry. */
  registrationsClosed: number;
  /** How many day entries were written in total. */
  daysClosed: number;
  /** Registrations whose overall status was settled to `no_show`. */
  markedNoShow: number;
  /** Attendance pushes the caller should deliver (is_present = no). */
  pushes: PendingPush[];
};

type AvailabilityRow = { date: string };

/**
 * Is this volunteer rostered on `day`?
 *
 * `serviceAvailability` holds the days the volunteer said they could serve.
 * Somebody who only signed up for the 29th must not be marked absent for the
 * 30th — they never claimed it.
 *
 * An EMPTY list means they never picked days (the event has no availability
 * slots, or they skipped that step), and is read as "available throughout" —
 * the same reading the seva sync uses, so the two jobs agree about who is
 * expected on a given day.
 */
export function servesOn(
  availability: AvailabilityRow[] | null | undefined,
  day: string
): boolean {
  if (!availability || availability.length === 0) return true;
  return availability.some((a) => a.date === day);
}

/**
 * Settle every elapsed day of one event.
 *
 * Writes the no-show entries and returns the pushes to deliver. The pushing
 * itself is left to the caller so the cron can rate-limit it through its own
 * worker pool — the community app sits behind a WAF that dislikes bursts.
 */
export async function closeOutElapsedDays(event: {
  _id: Types.ObjectId | string;
  eventId: string;
  eventStart?: Date | string | null;
  eventEnd?: Date | string | null;
}): Promise<CloseOutResult> {
  const today = todayKey();
  const allDays = eventDayKeys(event.eventStart, event.eventEnd);
  // Strictly before today: the current day is still in progress.
  const days = allDays.filter((d) => d < today);

  const empty: CloseOutResult = {
    days,
    registrationsClosed: 0,
    daysClosed: 0,
    markedNoShow: 0,
    pushes: [],
  };
  if (days.length === 0) return empty;

  const eventIsOver = allDays.length > 0 && allDays[allDays.length - 1] < today;

  const registrations = await Registration.find({
    eventId: event._id,
    status: { $ne: "cancelled" },
  }).select("status serviceId serviceAvailability dayAttendance");

  let registrationsClosed = 0;
  let daysClosed = 0;
  let markedNoShow = 0;
  const pushes: PendingPush[] = [];

  for (const registration of registrations) {
    const existing = registration.dayAttendance || [];
    const marked = new Set(
      existing.map((entry: { date: string }) => entry.date)
    );

    const missing = days.filter(
      (day) =>
        !marked.has(day) && servesOn(registration.serviceAvailability, day)
    );

    const hasAttended = existing.some(
      (entry: { status: string }) => entry.status === "attended"
    );

    // Once the last day has passed with nothing attended, the overall status
    // is a no-show too. Until then it stays whatever it was — the volunteer
    // may still turn up tomorrow.
    const shouldMarkNoShow =
      eventIsOver &&
      !hasAttended &&
      registration.status !== "no_show" &&
      (missing.length > 0 ||
        existing.some((entry: { status: string }) => entry.status === "no_show"));

    if (missing.length === 0 && !shouldMarkNoShow) continue;

    if (missing.length > 0) {
      registration.dayAttendance = [
        ...existing,
        ...missing.map((date) => ({
          date,
          status: "no_show" as const,
          source: "auto" as const,
        })),
      ];
      registrationsClosed++;
      daysClosed += missing.length;
    }

    if (shouldMarkNoShow) {
      registration.status = "no_show";
      markedNoShow++;
    }

    await registration.save();

    // Only registrations with a seva assigned are known to the community app —
    // `assign-seva` is what puts them there. Pushing an absence for a volunteer
    // they have never heard of just manufactures failed syncs.
    if (registration.serviceId) {
      for (const date of missing) {
        pushes.push({ registrationId: String(registration._id), date });
      }
    }
  }

  return { days, registrationsClosed, daysClosed, markedNoShow, pushes };
}
