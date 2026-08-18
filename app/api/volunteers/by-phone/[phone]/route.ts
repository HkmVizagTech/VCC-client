import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer, Registration } from "@/lib/models";

type Params = { params: Promise<{ phone: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { phone } = await params;
    await connectDB();

    const volunteer = await Volunteer.findOne({ phone });
    if (!volunteer) {
      return NextResponse.json(
        { message: "Volunteer not found" },
        { status: 404 }
      );
    }

    const registrations = await Registration.find({
      volunteerId: volunteer._id,
      status: { $ne: "cancelled" },
    })
      .populate("eventId", "name eventId status venue eventStart eventEnd")
      .populate({
        path: "serviceId",
        select: "name description coordinatorId",
        populate: { path: "coordinatorId", select: "name phone" },
      })
      .sort({ createdAt: -1 });

    return NextResponse.json({
      volunteer: {
        _id: volunteer._id,
        name: volunteer.name,
        phone: volunteer.phone,
        dateOfBirth: volunteer.dateOfBirth || null,
        photoKey: volunteer.photoKey,
      },
      registrations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
