import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/lib/models";

export async function GET() {
  try {
    await connectDB();
    const events = await Event.find({
      status: { $in: ["registration_open", "registration_closed", "ongoing"] },
    })
      .populate("coordinatorId", "name email")
      .sort({ eventStart: 1 });

    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
