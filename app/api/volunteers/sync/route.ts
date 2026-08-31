import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer } from "@/lib/models";
import { validatePhone } from "@/lib/utils/phone";
import { applyVolunteerProfile } from "@/lib/utils/volunteer-profile";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const name = body.name;
    const phone = body.phone || body.phone_number;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    const phoneResult = validatePhone(phone);
    if (!phoneResult.ok) {
      return NextResponse.json(
        { message: phoneResult.message },
        { status: 400 }
      );
    }

    let volunteer = await Volunteer.findOne({ phone: phoneResult.phone });
    let created = false;

    // Same rule as the public register route: the app's payload is the current
    // truth about this phone number, so it overwrites rather than fills in.
    if (volunteer) {
      if (applyVolunteerProfile(volunteer, body)) {
        await volunteer.save();
      }
    } else {
      volunteer = new Volunteer({ phone: phoneResult.phone, skills: [] });
      applyVolunteerProfile(volunteer, body);
      await volunteer.save();
      created = true;
    }

    return NextResponse.json(
      {
        message: created ? "User created" : "User found",
        volunteer: {
          _id: volunteer._id,
          name: volunteer.name,
          phone: volunteer.phone,
          dateOfBirth: volunteer.dateOfBirth || null,
          photoKey: volunteer.photoKey || null,
        },
      },
      { status: created ? 201 : 200 }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
