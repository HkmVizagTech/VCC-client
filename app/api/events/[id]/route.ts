import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Service, Registration, User } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { comparePassword } from "@/lib/utils/password";
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

    if (
      typeof body.eventId === "string" &&
      body.eventId.trim().toUpperCase() !== event.eventId
    ) {
      const superAuth = await authenticateWithRole(req, "super_admin");
      if (superAuth instanceof NextResponse) return superAuth;

      const password = body.password;
      delete body.password;
      if (!password) {
        return NextResponse.json(
          { message: "Password is required to change the Event ID" },
          { status: 400 }
        );
      }

      const admin = await User.findById(superAuth.userId);
      if (!admin || admin.role !== "super_admin") {
        return NextResponse.json(
          { message: "Access denied. Insufficient permissions." },
          { status: 403 }
        );
      }

      const isMatch = await comparePassword(password, admin.password);
      if (!isMatch) {
        return NextResponse.json(
          { message: "Incorrect password. Event ID not changed." },
          { status: 400 }
        );
      }

      body.eventId = body.eventId.trim().toUpperCase();
      const duplicate = await Event.findOne({
        eventId: body.eventId,
        _id: { $ne: id },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: "An event with this Event ID already exists" },
          { status: 400 }
        );
      }
    } else {
      delete body.password;
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

    const body = await req.json().catch(() => ({}));
    const password = body.password as string | undefined;
    if (!password) {
      return NextResponse.json(
        { message: "Password is required to delete an event" },
        { status: 400 }
      );
    }

    const admin = await User.findById(auth.userId);
    if (!admin || admin.role !== "super_admin") {
      return NextResponse.json(
        { message: "Access denied. Insufficient permissions." },
        { status: 403 }
      );
    }

    const isMatch = await comparePassword(password, admin.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Incorrect password. Event not deleted." },
        { status: 400 }
      );
    }

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    await Promise.all([
      Event.findByIdAndDelete(id),
      Service.deleteMany({ eventId: id }),
      Registration.deleteMany({ eventId: id }),
    ]);
    return NextResponse.json({ message: "Event deleted" });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
