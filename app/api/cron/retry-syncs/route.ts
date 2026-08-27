// ─── Failed-attendance-sync sweeper ─────────────────────────────────────────
// The durable half of "keep retrying". Vercel has no long-lived process, so
// the in-request retries (3 attempts over ~5s) cover transient blips, and this
// job — run every minute by Vercel Cron — picks up anything still failed:
// a WAF outage, their server down, a deploy of theirs mid-festival.
//
// Bounded on purpose. It takes the oldest BATCH_LIMIT failures per run rather
// than everything, so a total outage can never turn one cron tick into
// hundreds of simultaneous requests at a partner who is already struggling.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { pushAttendanceAndRecord } from "@/lib/attendance-sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 25;
const CONCURRENCY = 3;
/** Give up after this many tries — past here it is not transient, it needs a human. */
const MAX_ATTEMPTS = 20;
/** Ignore failures older than this; a stale festival is not worth retrying forever. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

type Row = {
  _id: unknown;
  attendanceSync?: { date: string; isPresent: boolean; attempts?: number };
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
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

    const rows = (await Registration.find(
      {
        "attendanceSync.status": "failed",
        "attendanceSync.attempts": { $lt: MAX_ATTEMPTS },
        "attendanceSync.lastAttemptAt": { $gte: new Date(Date.now() - LOOKBACK_MS) },
      },
      "attendanceSync"
    )
      .sort({ "attendanceSync.lastAttemptAt": 1 })
      .limit(BATCH_LIMIT)
      .lean()) as unknown as Row[];

    if (rows.length === 0) {
      return NextResponse.json({ picked: 0, recovered: 0, stillFailing: 0 });
    }

    let recovered = 0;
    let stillFailing = 0;
    let cursor = 0;

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, rows.length) },
      async () => {
        for (;;) {
          const index = cursor++;
          if (index >= rows.length) return;
          const row = rows[index];
          const sync = row.attendanceSync;
          if (!sync?.date) {
            stillFailing++;
            continue;
          }
          const result = await pushAttendanceAndRecord({
            registrationId: String(row._id),
            date: sync.date,
            isPresent: sync.isPresent,
          });
          if (result.ok) {
            recovered++;
          } else {
            stillFailing++;
          }
        }
      }
    );
    await Promise.all(workers);

    console.log(
      `[retry-syncs] picked ${rows.length}, recovered ${recovered}, still failing ${stillFailing}`
    );

    return NextResponse.json({
      picked: rows.length,
      recovered,
      stillFailing,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("[retry-syncs] run failed:", message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
