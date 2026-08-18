import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer } from "@/lib/models";
import { validatePhone } from "@/lib/utils/phone";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const name = body.name;
    const phone = body.phone || body.phone_number;
    const dateOfBirth = body.dateOfBirth || body.date_of_birth;

    if (!name) {
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

    if (volunteer) {
      if (dateOfBirth && !volunteer.dateOfBirth) {
        volunteer.dateOfBirth = new Date(dateOfBirth);
      }
      if (name && name !== volunteer.name) {
        volunteer.name = name;
      }
      if (volunteer.isModified()) {
        await volunteer.save();
      }
    } else {
      volunteer = await Volunteer.create({
        name,
        phone: phoneResult.phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      });
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
