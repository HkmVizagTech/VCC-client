import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { sanitizeCustomFields } from "@/lib/utils/custom-fields";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");

    const filter: any = {};
    if (status) filter.status = status;
    if (auth.role === "event_coordinator") {
      filter.coordinatorId = auth.userId;
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate("coordinatorId", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return NextResponse.json({
      events,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const body = await req.json();

    if (!body.eventId || !body.name || !body.eventStart || !body.eventEnd) {
      return NextResponse.json(
        { message: "Event ID, name, eventStart, and eventEnd are required" },
        { status: 400 }
      );
    }

    if (!body.coordinatorId) {
      return NextResponse.json(
        { message: "Coordinator is required" },
        { status: 400 }
      );
    }

    const existingEvent = await Event.findOne({ eventId: body.eventId.toUpperCase() });
    if (existingEvent) {
      return NextResponse.json(
        { message: "An event with this Event ID already exists" },
        { status: 409 }
      );
    }

    const event = await Event.create({
      ...body,
      eventId: body.eventId.toUpperCase(),
      customFields: sanitizeCustomFields(body.customFields),
      createdBy: auth.userId,
    });

    return NextResponse.json(
      { message: "Event created", event },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { message: "An event with this Event ID already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
