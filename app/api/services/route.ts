import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Service, Event } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const body = await req.json();

    if (!body.eventId || !body.name) {
      return NextResponse.json(
        { message: "eventId and name are required" },
        { status: 400 }
      );
    }

    if (!body.coordinatorId) {
      return NextResponse.json(
        { message: "Coordinator is required" },
        { status: 400 }
      );
    }

    const event = await Event.findById(body.eventId);
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    const service = await Service.create({
      ...body,
      createdBy: auth.userId,
    });

    return NextResponse.json(
      { message: "Service created", service },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { message: "A service with this name already exists for this event" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
