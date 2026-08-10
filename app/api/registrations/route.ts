import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Event, Volunteer, Registration } from "@/lib/models";
import { generateVolunteerNumber } from "@/lib/utils/volunteer-number";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { eventId, name, phone, whatsappNumber, age, gender, locality, occupation, skills, serviceAvailability, notes } = body;

    if (!eventId || !name || !phone) {
      return NextResponse.json(
        { message: "eventId, name, and phone are required" },
        { status: 400 }
      );
    }

    const event = await Event.findById(eventId);
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

    let volunteer = await Volunteer.findOne({ phone });
    if (!volunteer) {
      const volunteerNumber = await generateVolunteerNumber();
      const sevaToken = crypto.randomBytes(32).toString("hex");
      volunteer = await Volunteer.create({
        name,
        phone,
        whatsappNumber,
        age,
        gender,
        locality,
        occupation,
        skills: skills || [],
        notes,
        volunteerNumber,
        sevaToken,
      });
    }

    const existingReg = await Registration.findOne({
      eventId,
      volunteerId: volunteer._id,
    });
    if (existingReg) {
      return NextResponse.json(
        {
          message: "Already registered for this event",
          registration: existingReg,
          volunteer,
        },
        { status: 409 }
      );
    }

    const registration = await Registration.create({
      eventId,
      volunteerId: volunteer._id,
      serviceAvailability: serviceAvailability || [],
      notes,
    });

    return NextResponse.json(
      {
        message: "Registration successful",
        registration,
        volunteer: {
          _id: volunteer._id,
          name: volunteer.name,
          volunteerNumber: volunteer.volunteerNumber,
          sevaToken: volunteer.sevaToken,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { message: "Already registered for this event" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
