import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

// GET /api/stats/events — lightweight event list for the attendance screen.
// Returns all events that can have attendance tracked (not draft/archived),
// including the human-readable eventId code used for the check-in QR.
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();

    const events = await Event.find(
      { status: { $nin: ["draft", "archived"] } },
      { name: 1, eventId: 1, status: 1, eventStart: 1, eventEnd: 1, venue: 1 }
    ).sort({ eventStart: -1 });

    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
