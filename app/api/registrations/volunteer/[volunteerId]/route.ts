import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

type Params = { params: Promise<{ volunteerId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { volunteerId } = await params;
    await connectDB();

    const registrations = await Registration.find({ volunteerId })
      .populate("eventId", "name eventId status eventStart eventEnd venue")
      .populate("serviceId", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json({ registrations });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
