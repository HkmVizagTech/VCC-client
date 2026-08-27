// ─── Daily seva re-sync ─────────────────────────────────────────────────────
// The community app rebuilds each volunteer's card at midnight, so a seva
// pushed yesterday is not shown today — it expects VCC to send the assignment
// again for the current day. `assign-seva` carries no date field, so their
// side dates it by when we call: one push per volunteer per day is exactly the
// shape their design expects.
//
// Runs from Vercel Cron (see vercel.json) at 01:00 IST — after the app's
// midnight refresh, and while volunteers are asleep. Vercel schedules in UTC,
// so the expression is "30 19 * * *" (19:30 UTC = 01:00 IST the next day).
// Also safe to invoke by hand with the same bearer token — it is idempotent
// for a given day, PROVIDED it runs once. Do not schedule it more than daily:
// their API does not de-duplicate, so two runs would give every volunteer two
// sevas for the same day.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import { Registration, Event } from "@/lib/models";
import { todayKey, dateInEventRange } from "@/lib/utils/event-days";
import { syncAssignSevaNow } from "@/lib/community-sync";

// Hundreds of volunteers at ~1s each — well past the default limit.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Their host sits behind a WAF; a burst of parallel requests risks being
// throttled, and there is no hurry at 00:10.
const CONCURRENCY = 4;

// Shapes we read back. Both queries use .lean() — nothing here is mutated, so
// there is no reason to hydrate full mongoose documents, and plain objects let
// us state the types outright instead of depending on inference.
type EventRow = {
  _id: Types.ObjectId;
  eventId: string;
  name: string;
  eventStart: Date;
  eventEnd: Date;
};
type PopulatedVolunteer = { phone?: string };
type PopulatedService = {
  name?: string;
  coordinatorId?: { phone?: string } | null;
};
type RegistrationRow = {
  volunteerId?: PopulatedVolunteer | null;
  serviceId?: PopulatedService | null;
  serviceAvailability?: Array<{ date: string }> | null;
};

/**
 * Is this volunteer serving on `day`?
 *
 * `serviceAvailability` holds the days the volunteer said they can serve, e.g.
 * [{date:"2026-08-26"},{date:"2026-08-27"}]. Somebody who only signed up for
 * the 26th must not have a seva pushed on the 27th.
 *
 * An EMPTY list means the volunteer never picked specific days — either the
 * event has no availability slots configured, or they skipped that step. Those
 * are treated as available throughout, since the alternative is silently never
 * syncing them at all.
 */
function servesOn(reg: RegistrationRow, day: string): boolean {
  const availability = reg.serviceAvailability;
  if (!availability || availability.length === 0) return true;
  return availability.some((a) => a.date === day);
}

/** Run `fn` over `items` with a fixed number of workers, tallying outcomes. */
async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<boolean>
) {
  let cursor = 0;
  let ok = 0;
  let failed = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        try {
          const success = await fn(items[index]);
          if (success) {
            ok++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    }
  );
  await Promise.all(workers);
  return { ok, failed };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refuse rather than run unauthenticated — this endpoint writes to a
    // third-party system and must never be open to the internet.
    return NextResponse.json(
      { message: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const today = todayKey();

    // Narrow in the DB with a generous window, then decide membership exactly
    // in IST — a UTC-range query alone would misjudge events that start or end
    // within 5.5 hours of midnight.
    const DAY_MS = 86_400_000;
    const now = Date.now();
    const candidates = (await Event.find(
      {
        status: { $nin: ["draft", "archived"] },
        eventStart: { $lte: new Date(now + 2 * DAY_MS) },
        eventEnd: { $gte: new Date(now - 2 * DAY_MS) },
      },
      "eventId name eventStart eventEnd"
    ).lean()) as unknown as EventRow[];

    const running = candidates.filter((e) =>
      dateInEventRange(today, e.eventStart, e.eventEnd)
    );

    if (running.length === 0) {
      console.log(`[daily-seva-sync] ${today}: no events running, nothing to do`);
      return NextResponse.json({ date: today, events: [], pushed: 0, failed: 0 });
    }

    const summary: Array<Record<string, unknown>> = [];
    let totalOk = 0;
    let totalFailed = 0;

    for (const event of running) {
      const regs = (await Registration.find({
        eventId: event._id,
        serviceId: { $ne: null },
        status: { $nin: ["cancelled"] },
      })
        .populate("volunteerId", "phone")
        .populate({
          path: "serviceId",
          select: "name coordinatorId",
          populate: { path: "coordinatorId", select: "phone" },
        })
        .lean()) as unknown as RegistrationRow[];

      type Task = {
        phone: string;
        serviceName: string;
        devoteePhone: string | undefined;
      };

      // Only volunteers actually serving today. Someone who signed up for the
      // 26th alone gets nothing pushed on the 27th, and nobody is pushed ahead
      // of a day they have not reached yet.
      const serving = regs.filter((reg) => servesOn(reg, today));
      const notServingToday = regs.length - serving.length;

      const tasks = serving
        .map((reg): Task | null => {
          const phone = reg.volunteerId?.phone;
          const serviceName = reg.serviceId?.name;
          if (!phone || !serviceName) return null;
          return {
            phone,
            serviceName,
            devoteePhone: reg.serviceId?.coordinatorId?.phone || undefined,
          };
        })
        .filter((t): t is Task => t !== null);

      const { ok, failed } = await runPool(tasks, CONCURRENCY, (t: Task) =>
        syncAssignSevaNow(event.eventId, t.serviceName, t.phone, t.devoteePhone)
      );

      totalOk += ok;
      totalFailed += failed;
      summary.push({
        eventId: event.eventId,
        name: event.name,
        withService: regs.length,
        servingToday: tasks.length,
        skippedNotServingToday: notServingToday,
        pushed: ok,
        failed,
      });
      console.log(
        `[daily-seva-sync] ${today} ${event.eventId}: ${ok}/${tasks.length} pushed` +
          (failed ? `, ${failed} failed` : "") +
          (notServingToday
            ? `, ${notServingToday} skipped (not serving today)`
            : "")
      );
    }

    return NextResponse.json({
      date: today,
      events: summary,
      pushed: totalOk,
      failed: totalFailed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[daily-seva-sync] run failed:", message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
