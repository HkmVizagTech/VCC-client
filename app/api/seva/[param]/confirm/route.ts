import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";

type Params = { params: Promise<{ param: string }> };

export async function PUT(_req: NextRequest, { params }: Params) {
  try {
    const { param: id } = await params;
    await connectDB();

    const registration = await Registration.findById(id);
    if (!registration) {
      return NextResponse.json(
        { message: "Registration not found" },
        { status: 404 }
      );
    }

    if (!["assigned", "registered"].includes(registration.status)) {
      return NextResponse.json(
        { message: `Cannot confirm from status: ${registration.status}` },
        { status: 400 }
      );
    }

    registration.status = "confirmed";
    await registration.save();

    return NextResponse.json({ message: "Seva confirmed", registration });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
