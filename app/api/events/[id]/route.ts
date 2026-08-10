import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { sanitizeCustomFields } from "@/lib/utils/custom-fields";

const VALID_TRANSITIONS: Record<string, string> = {
  draft: "registration_open",
  registration_open: "registration_closed",
  registration_closed: "ongoing",
  ongoing: "completed",
  completed: "archived",
};

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();

    const event = await Event.findById(id).populate(
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

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    if (body.status && body.status !== event.status) {
      const allowedNext = VALID_TRANSITIONS[event.status];
      if (body.status !== allowedNext) {
        return NextResponse.json(
          {
            message: `Cannot transition from ${event.status} to ${body.status}. Next valid status: ${allowedNext || "none"}`,
          },
          { status: 400 }
        );
      }
    }

    if (body.customFields !== undefined) {
      body.customFields = sanitizeCustomFields(body.customFields);
    }

    Object.assign(event, body);
    await event.save();

    return NextResponse.json({ message: "Event updated", event });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "super_admin");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    if (event.status !== "draft") {
      return NextResponse.json(
        { message: "Only draft events can be deleted" },
        { status: 400 }
      );
    }

    await Event.findByIdAndDelete(id);
    return NextResponse.json({ message: "Event deleted" });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
