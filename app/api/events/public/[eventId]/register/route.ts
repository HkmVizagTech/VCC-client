import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Volunteer, Registration } from "@/lib/models";
import { validatePhone } from "@/lib/utils/phone";
import { validateAndNormalizeAnswers } from "@/lib/utils/custom-fields";

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
      skills,
      photoKey,
      serviceAvailability,
      customAnswers,
      notes,
    } = body;

    if (!name) {
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

    let volunteer = await Volunteer.findOne({ phone: phoneResult.phone });
    if (!volunteer) {
      volunteer = await Volunteer.create({
        name,
        phone: phoneResult.phone,
        age,
        gender,
        locality,
        occupation,
        skills: skills || [],
        photoKey: photoKey || undefined,
        notes,
      });
    } else if (photoKey && !volunteer.photoKey) {
      volunteer.photoKey = photoKey;
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
