// POST /api/registrations/:id/attendance/resync
//
// Re-pushes a volunteer's attendance to the community app WITHOUT touching the
// attendance record itself. This is the Retry button in the admin table: when
// `attendanceSync.status` is "failed", a coordinator can fire it again rather
// than needing someone to read Vercel logs and run curl.
//
// Awaits the push (unlike the check-in path) because whoever pressed the
// button is waiting to be told whether it worked.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { pushAttendanceAndRecord } from "@/lib/attendance-sync";

type Params = { params: Promise<{ id: string }> };

type DayEntry = { date: string; status: "attended" | "no_show" };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await connectDB();

    const registration = await Registration.findById(
      id,
      "dayAttendance attendanceSync"
    );
    if (!registration) {
      return NextResponse.json(
        { message: "Registration not found" },
        { status: 404 }
      );
    }

    // Which day to re-push: the one asked for, else the day of the last failed
    // attempt. Never invent one — re-pushing the wrong date would write a
    // second, contradictory record on their side.
    const date: string =
      typeof body.date === "string" && body.date
        ? body.date
        : registration.attendanceSync?.date || "";
    if (!date) {
      return NextResponse.json(
        { message: "No attendance date to re-sync" },
        { status: 400 }
      );
    }

    // Take the truth from VCC's own record rather than from whatever was sent
    // last time — if an admin corrected the attendance after the failed push,
    // the retry must send the corrected value.
    const days = (registration.dayAttendance || []) as DayEntry[];
    const entry = days.find((d) => d.date === date);
    if (!entry) {
      return NextResponse.json(
        { message: `No attendance recorded for ${date}` },
        { status: 400 }
      );
    }

    const result = await pushAttendanceAndRecord({
      registrationId: id,
      date,
      isPresent: entry.status === "attended",
    });

    return NextResponse.json(
      {
        message: result.ok
          ? "Synced to the community app"
          : `Sync failed: ${result.detail}`,
        ok: result.ok,
        date,
      },
      { status: result.ok ? 200 : 502 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
