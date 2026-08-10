import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer } from "@/lib/models";

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

    return NextResponse.json({ volunteer });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
