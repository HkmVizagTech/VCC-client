// ─── Attendance sync recorder ───────────────────────────────────────────────
// One place that pushes an attendance change to the community app AND records
// what happened on the registration, so the check-in route, the admin route,
// the manual retry and the sweeper can never disagree about how it is stored.
//
// The push is deliberately NOT allowed to affect whether attendance is saved.
// A volunteer who scanned is attended, full stop — their record must survive a
// WAF block, a timeout, or the partner being down. What this adds is
// visibility: the outcome lands on `registration.attendanceSync`, which the
// admin table renders as synced / failed / pending.

import { Registration, Volunteer, Event } from "@/lib/models";
import { syncMarkAttendanceNow, type SyncResult } from "@/lib/community-sync";

type Args = {
  registrationId: string;
  /** `yyyy-MM-dd` event day this push is about. */
  date: string;
  /** true → is_present "yes", false → "no" (an unmark). */
  isPresent: boolean;
};

/**
 * Push one attendance change and record the outcome.
 *
 * Resolves to the result so a caller that wants to report it (the manual retry
 * endpoint) can. Never throws — a failure here must not surface as a 500 on a
 * check-in that already succeeded.
 */
export async function pushAttendanceAndRecord({
  registrationId,
  date,
  isPresent,
}: Args): Promise<SyncResult> {
  try {
    const registration = await Registration.findById(
      registrationId,
      "volunteerId eventId attendanceSync"
    );
    if (!registration) {
      return { ok: false, detail: "Registration not found" };
    }

    const [volunteer, event] = await Promise.all([
      Volunteer.findById(registration.volunteerId, "phone"),
      Event.findById(registration.eventId, "eventId"),
    ]);
    if (!volunteer?.phone || !event?.eventId) {
      const detail = "Missing volunteer phone or event code";
      await recordOutcome(registrationId, date, isPresent, { ok: false, detail });
      return { ok: false, detail };
    }

    const previousAttempts = registration.attendanceSync?.attempts ?? 0;
    const result = await syncMarkAttendanceNow(
      event.eventId,
      volunteer.phone,
      isPresent,
      date
    );
    await recordOutcome(registrationId, date, isPresent, result, previousAttempts);
    return result;
  } catch (error: unknown) {
    const detail =
      error instanceof Error ? error.message : "Unexpected sync error";
    await recordOutcome(registrationId, date, isPresent, { ok: false, detail });
    return { ok: false, detail };
  }
}

async function recordOutcome(
  registrationId: string,
  date: string,
  isPresent: boolean,
  result: SyncResult,
  previousAttempts = 0
) {
  try {
    await Registration.updateOne(
      { _id: registrationId },
      {
        $set: {
          attendanceSync: {
            date,
            isPresent,
            status: result.ok ? "synced" : "failed",
            attempts: previousAttempts + 1,
            lastAttemptAt: new Date(),
            reason: result.ok ? undefined : result.detail.slice(0, 300),
          },
        },
      }
    );
  } catch (error: unknown) {
    // Writing the status must never break the caller — losing the badge is
    // survivable, losing the check-in is not.
    console.error(
      "[attendance-sync] could not record outcome:",
      error instanceof Error ? error.message : error
    );
  }
}

// Note: there is deliberately no "mark pending" write on the check-in path.
// It would add a second DB round-trip to the latency-sensitive gate scan to
// describe a state that lasts about a second. The admin table instead treats
// "attendance recorded for this day, but no attendanceSync row matching it" as
// pending, which needs no extra write and is true by construction.
