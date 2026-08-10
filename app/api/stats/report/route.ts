import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const filter: any = {};
    if (eventId) filter.eventId = eventId;

    const registrations = await Registration.find(filter)
      .populate("volunteerId")
      .populate("eventId", "name slug venue eventStart eventEnd")
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
