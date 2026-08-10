import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer, Otp } from "@/lib/models";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json(
        { message: "Phone number is required" },
        { status: 400 }
      );
    }

    const volunteer = await Volunteer.findOne({ phone });
    if (!volunteer) {
      return NextResponse.json(
        { message: "No volunteer found with this phone number" },
        { status: 404 }
      );
    }

    const recentOtp = await Otp.findOne({
      phone,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recentOtp) {
      return NextResponse.json(
        { message: "Please wait 60 seconds before requesting another OTP" },
        { status: 429 }
      );
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.create({ phone, otp, expiresAt });

    console.log(`[OTP] ${phone}: ${otp}`);

    return NextResponse.json({
      message: "OTP sent successfully",
      // TODO: Integrate actual SMS/WhatsApp delivery
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
