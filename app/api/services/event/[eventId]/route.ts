import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Service } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { eventId } = await params;
    await connectDB();

    const services = await Service.find({ eventId }).populate(
      "coordinatorId",
      "name email"
    );

    return NextResponse.json({ services });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
