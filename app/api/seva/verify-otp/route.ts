import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer, Otp, Registration } from "@/lib/models";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { message: "Phone and OTP are required" },
        { status: 400 }
      );
    }

    const otpDoc = await Otp.findOne({
      phone,
      otp,
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return NextResponse.json(
        { message: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    otpDoc.verified = true;
    await otpDoc.save();

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
      .populate("eventId", "name slug status venue eventStart eventEnd")
      .populate({
        path: "serviceId",
        select: "name description coordinatorId",
        populate: { path: "coordinatorId", select: "name phone" },
      })
      .sort({ createdAt: -1 });

    return NextResponse.json({
      volunteer: {
        name: volunteer.name,
        volunteerNumber: volunteer.volunteerNumber,
        phone: volunteer.phone,
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
