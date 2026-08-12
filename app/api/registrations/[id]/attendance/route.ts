import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { dateInEventRange } from "@/lib/utils/event-days";

type Params = { params: Promise<{ id: string }> };

type DayEntry = {
  date: string;
  status: "attended" | "no_show";
  checkedInAt?: Date;
  source?: "qr" | "admin";
};

// PUT /api/registrations/:id/attendance — admin per-day attendance
// Body: { date: "yyyy-MM-dd", status: "attended" | "no_show" | "unmark" }
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { date, status } = await req.json();

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { message: "A valid date (yyyy-MM-dd) is required" },
        { status: 400 }
      );
    }
    if (!["attended", "no_show", "unmark"].includes(status)) {
      return NextResponse.json(
        { message: "Status must be attended, no_show or unmark" },
        { status: 400 }
      );
    }

    await connectDB();

    const registration = await Registration.findById(id).populate(
      "eventId",
      "eventStart eventEnd"
    );
    if (!registration) {
      return NextResponse.json(
        { message: "Registration not found" },
        { status: 404 }
      );
    }

    const event = registration.eventId as unknown as {
      eventStart?: Date;
      eventEnd?: Date;
    };
    if (!dateInEventRange(date, event.eventStart, event.eventEnd)) {
      return NextResponse.json(
        { message: "Date is outside the event dates" },
        { status: 400 }
      );
    }

    const dayAttendance: DayEntry[] = registration.dayAttendance || [];
    const existing = dayAttendance.find((d) => d.date === date);

    if (status === "unmark") {
      if (!existing) {
        return NextResponse.json({
          message: "No attendance record for this date",
          registration,
        });
      }
      const wasAttended = existing.status === "attended";
      registration.dayAttendance = dayAttendance.filter(
        (d) => d.date !== date
      );

      // If the volunteer's only attended day is removed, revert the overall
      // status back to the pending pool.
      if (
        wasAttended &&
        registration.status === "attended" &&
        !(registration.dayAttendance || []).some(
          (d) => d.status === "attended"
        )
      ) {
        registration.status = registration.serviceId ? "assigned" : "registered";
      }
      await registration.save();

      return NextResponse.json({
        message: "Attendance record removed",
        registration,
      });
    }

    // Upsert the day's outcome.
    const entry: DayEntry = {
      date,
      status: status as "attended" | "no_show",
      checkedInAt: existing?.checkedInAt || new Date(),
      source: status === "attended" ? "admin" : existing?.source || "admin",
    };
    registration.dayAttendance = [
      ...dayAttendance.filter((d) => d.date !== date),
      entry,
    ];

    if (status === "attended" && registration.status !== "cancelled") {
      registration.status = "attended";
    }
    await registration.save();

    return NextResponse.json({
      message: status === "attended" ? "Checked in" : "Marked as no show",
      registration,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
