import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Service, Registration, User } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { comparePassword } from "@/lib/utils/password";
import { sanitizeCustomFields } from "@/lib/utils/custom-fields";
import { normalizeEventDates } from "@/lib/utils/event-days";

// The natural forward progression of an event.
const VALID_TRANSITIONS: Record<string, string> = {
  draft: "registration_open",
  registration_open: "registration_closed",
  registration_closed: "ongoing",
  ongoing: "completed",
  completed: "archived",
};

/**
 * Which status changes this endpoint accepts.
 *
 * Two rules used to disagree: PUT /api/events/:id enforced the strict forward
 * chain above, while PUT /api/events/:id/status — the one the admin UI actually
 * calls — accepted any status jumping to any other. So the same change was
 * rejected or allowed depending on which screen you were on.
 *
 * The rule now: move forward one step, or park the event back to `draft` from
 * anywhere. Parking is deliberate — events are created as `registration_open`,
 * so "put it back out of sight while I finish setting it up" is the normal
 * correction, and the old chain made it impossible.
 */
function isAllowedStatusChange(from: string, to: string): boolean {
  if (from === to) return true;
  if (to === "draft") return true;
  return VALID_TRANSITIONS[from] === to;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();

    const event = await Event.findById(id).populate(
      "coordinatorId",
      "name email phone"
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

    if (body.status && !isAllowedStatusChange(event.status, body.status)) {
      const allowedNext = VALID_TRANSITIONS[event.status];
      return NextResponse.json(
        {
          message: `Cannot transition from ${event.status} to ${body.status}. Move it to ${allowedNext || "draft"}, or back to draft.`,
        },
        { status: 400 }
      );
    }

    if (body.customFields !== undefined) {
      body.customFields = sanitizeCustomFields(body.customFields);
    }

    // Bare datetime-local values mean IST, not UTC — see normalizeEventDates.
    // Without this, opening an event and re-saving it shifted every time by
    // +5:30, compounding on each edit.
    Object.assign(event, normalizeEventDates(body));
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
