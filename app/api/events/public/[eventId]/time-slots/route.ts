import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/lib/models";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    await connectDB();

    const event = await Event.findOne(
      { eventId: eventId.toUpperCase() },
      { availabilitySlots: 1, eventStart: 1, eventEnd: 1, name: 1, eventId: 1 }
    );

    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      eventId: event.eventId,
      name: event.name,
      eventStart: event.eventStart,
      eventEnd: event.eventEnd,
      timeSlots: (event.availabilitySlots || []).map((day: any) => ({
        date: day.date,
        slots: (day.slots || []).map((s: any) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          label: s.label || `${s.startTime} - ${s.endTime}`,
        })),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
