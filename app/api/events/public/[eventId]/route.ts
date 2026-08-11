import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/lib/models";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    await connectDB();

    const event = await Event.findOne({ eventId: eventId.toUpperCase() }).populate(
      "coordinatorId",
      "name email"
    );
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ event });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
