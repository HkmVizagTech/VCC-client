import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Volunteer, Registration } from "@/lib/models";
import { validatePhone } from "@/lib/utils/phone";
import { validateAndNormalizeAnswers } from "@/lib/utils/custom-fields";
import { applyVolunteerProfile } from "@/lib/utils/volunteer-profile";

type Params = { params: Promise<{ eventId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    await connectDB();

    const body = await req.json();
    const {
      name,
      age,
      gender,
      locality,
      occupation,
      occupationType,
      institution,
      company,
      skills,
      photoKey,
      serviceAvailability,
      customAnswers,
      notes,
    } = body;

    const dateOfBirth = body.dateOfBirth || body.date_of_birth;

    // Must be a real string: the name is what overwrites the stored volunteer
    // below, and a blank or non-string one would leave a new document without
    // the field the schema requires — a 500 where a 400 belongs.
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    const phoneResult = validatePhone(body.phone);
    if (!phoneResult.ok) {
      return NextResponse.json(
        { message: phoneResult.message },
        { status: 400 }
      );
    }

    const event = await Event.findOne({ eventId: eventId.toUpperCase() });
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    if (event.status !== "registration_open") {
      return NextResponse.json(
        { message: "Registration is not open for this event" },
        { status: 400 }
      );
    }

    if (event.registrationEnd && new Date() > new Date(event.registrationEnd)) {
      return NextResponse.json(
        { message: "Registration deadline has passed" },
        { status: 400 }
      );
    }

    const answerResult = validateAndNormalizeAnswers(
      event.customFields,
      customAnswers
    );
    if (!answerResult.ok) {
      return NextResponse.json(
        { message: answerResult.message },
        { status: 400 }
      );
    }

    // The app owns the volunteer's identity, not VCC.
    //
    // We find the volunteer by phone, and a phone number is not a person: it
    // gets shared, lent and reassigned between events. So whatever the app
    // sends now REPLACES what we hold — otherwise a number first registered
    // years ago as "Radha" keeps showing that name for whoever uses it today.
    // Fields the payload doesn't carry are left alone; see
    // lib/utils/volunteer-profile.ts.
    const profile = {
      name,
      dateOfBirth,
      age,
      gender,
      locality,
      occupation,
      occupationType,
      institution,
      company,
      skills,
      photoKey,
      notes,
    };

    let volunteer = await Volunteer.findOne({ phone: phoneResult.phone });
    if (!volunteer) {
      volunteer = new Volunteer({ phone: phoneResult.phone, skills: [] });
      applyVolunteerProfile(volunteer, profile);
      await volunteer.save();
    } else if (applyVolunteerProfile(volunteer, profile)) {
      // Runs before the "already registered" check below on purpose: a repeat
      // registration is the app telling us about this number again, and the
      // corrected name must stick even though no new registration is created.
      await volunteer.save();
    }

    const existingReg = await Registration.findOne({
      eventId: event._id,
      volunteerId: volunteer._id,
    });
    if (existingReg) {
      return NextResponse.json(
        {
          message: "Already registered for this event",
          registration: existingReg,
          volunteer: {
            _id: volunteer._id,
            name: volunteer.name,
            phone: volunteer.phone,
            dateOfBirth: volunteer.dateOfBirth || null,
            photoKey: volunteer.photoKey,
          },
        },
        { status: 409 }
      );
    }

    const registration = await Registration.create({
      eventId: event._id,
      volunteerId: volunteer._id,
      serviceAvailability: serviceAvailability || [],
      customAnswers: answerResult.answers,
      notes,
    });

    return NextResponse.json(
      {
        message: "Registration successful",
        registration,
        volunteer: {
          _id: volunteer._id,
          name: volunteer.name,
          phone: volunteer.phone,
          dateOfBirth: volunteer.dateOfBirth || null,
          photoKey: volunteer.photoKey,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 11000) {
      return NextResponse.json(
        { message: "Already registered for this event" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
