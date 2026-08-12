import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Volunteer, Registration } from "@/lib/models";
import { validatePhone } from "@/lib/utils/phone";
import { eventDayKeys, dateInEventRange, todayKey } from "@/lib/utils/event-days";

type Params = { params: Promise<{ eventId: string }> };

type DayEntry = {
  date: string;
  status: "attended" | "no_show";
  checkedInAt?: Date;
  source?: "qr" | "admin";
};

type LookupResult =
  | { error: NextResponse }
  | {
      error: null;
      event: {
        _id: unknown;
        name: string;
        venue?: string;
        eventStart?: Date;
        eventEnd?: Date;
      };
      volunteer: { _id: unknown; name: string; phone: string; photoKey?: string };
      registration: {
        _id: unknown;
        status: string;
        dayAttendance?: DayEntry[];
        serviceId?: { _id: string; name: string } | null;
        save: () => Promise<unknown>;
      };
    };

/**
 * Shared lookup used by both GET (identity check) and POST (final confirm).
 * Any registered volunteer (status not `cancelled`) can check in — being at
 * the venue and scanning the QR is the proof of presence.
 */
async function findRegistration(
  eventId: string,
  phoneRaw: unknown
): Promise<LookupResult> {
  const phoneResult = validatePhone(phoneRaw);
  if (!phoneResult.ok) {
    return {
      error: NextResponse.json(
        { message: phoneResult.message },
        { status: 400 }
      ),
    };
  }

  await connectDB();

  const event = await Event.findOne({ eventId: eventId.toUpperCase() });
  if (!event) {
    return {
      error: NextResponse.json({ message: "Event not found" }, { status: 404 }),
    };
  }

  const volunteer = await Volunteer.findOne({ phone: phoneResult.phone });
  if (!volunteer) {
    return {
      error: NextResponse.json(
        { message: "You are not registered as a volunteer" },
        { status: 404 }
      ),
    };
  }

  const registration = await Registration.findOne({
    eventId: event._id,
    volunteerId: volunteer._id,
    status: { $ne: "cancelled" },
  }).populate("serviceId", "name");

  if (!registration) {
    return {
      error: NextResponse.json(
        { message: "You are not registered for this event" },
        { status: 404 }
      ),
    };
  }

  return {
    error: null,
    event,
    volunteer,
    registration: registration as unknown as {
      _id: unknown;
      status: string;
      dayAttendance?: DayEntry[];
      serviceId?: { _id: string; name: string } | null;
      save: () => Promise<unknown>;
    },
  };
}

// GET /api/events/public/:eventId/check-in?phone=9876543210
// Identity lookup — "is this you?" step before confirming attendance.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    const phone = req.nextUrl.searchParams.get("phone");

    const found = await findRegistration(eventId, phone);
    if (found.error) return found.error;

    const { event, volunteer, registration } = found;
    const service = registration.serviceId as unknown as
      | { _id: string; name: string }
      | undefined;

    const days = eventDayKeys(event.eventStart, event.eventEnd);
    const dayAttendance = registration.dayAttendance || [];

    return NextResponse.json({
      volunteer: {
        _id: volunteer._id,
        name: volunteer.name,
        phone: volunteer.phone,
        photoKey: volunteer.photoKey,
      },
      event: {
        _id: event._id,
        name: event.name,
        venue: event.venue,
        eventStart: event.eventStart,
        eventEnd: event.eventEnd,
        days,
      },
      registration: {
        _id: registration._id,
        status: registration.status,
        alreadyCheckedIn: dayAttendance.some((d) => d.status === "attended"),
        checkedInDays: dayAttendance
          .filter((d) => d.status === "attended")
          .map((d) => d.date),
        noShowDays: dayAttendance
          .filter((d) => d.status === "no_show")
          .map((d) => d.date),
        serviceId: service ? { _id: service._id, name: service.name } : null,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

// POST /api/events/public/:eventId/check-in — confirm attendance for a day.
// Body: { phone, date? } — date is a `yyyy-MM-dd` event day (defaults to today).
// Idempotent per day: checking in for an already-attended day returns the
// same success shape with alreadyCheckedIn: true.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    const body = await req.json();

    const found = await findRegistration(eventId, body.phone);
    if (found.error) return found.error;

    const { event, volunteer, registration } = found;

    const days = eventDayKeys(event.eventStart, event.eventEnd);
    if (days.length === 0) {
      return NextResponse.json(
        { message: "Event has no attendance days" },
        { status: 400 }
      );
    }

    // Resolve the day: explicit date, else today if the event is running,
    // else the first event day.
    let date = typeof body.date === "string" ? body.date : "";
    if (!date) {
      const today = todayKey();
      date = days.includes(today) ? today : days[0];
    }
    if (!dateInEventRange(date, event.eventStart, event.eventEnd)) {
      return NextResponse.json(
        { message: "Invalid check-in date" },
        { status: 400 }
      );
    }

    const dayAttendance = registration.dayAttendance || [];
    const existing = dayAttendance.find((d) => d.date === date);
    const alreadyCheckedIn = existing?.status === "attended";

    if (!alreadyCheckedIn) {
      // Upsert this day's outcome. A "no_show" day is overridden — the
      // volunteer is physically present and scanning the QR.
      const next: DayEntry[] = [
        ...dayAttendance.filter((d) => d.date !== date),
        {
          date,
          status: "attended",
          checkedInAt: existing?.checkedInAt || new Date(),
          source: "qr",
        },
      ];
      registration.dayAttendance = next;

      // Keep the overall status truthful: attended = showed up on at least one day.
      if (registration.status !== "cancelled") {
        registration.status = "attended";
      }
      await registration.save();
    }

    const service = registration.serviceId as unknown as
      | { _id: string; name: string }
      | undefined;

    const checkedInDays = (registration.dayAttendance || [])
      .filter((d) => d.status === "attended")
      .map((d) => d.date);

    return NextResponse.json({
      message: alreadyCheckedIn ? "Already checked in" : "Check-in successful",
      alreadyCheckedIn,
      date,
      checkedInDays,
      volunteer: {
        _id: volunteer._id,
        name: volunteer.name,
        phone: volunteer.phone,
        photoKey: volunteer.photoKey,
      },
      event: { _id: event._id, name: event.name, venue: event.venue },
      registration: {
        _id: registration._id,
        status: registration.status,
        serviceId: service ? { _id: service._id, name: service.name } : null,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
