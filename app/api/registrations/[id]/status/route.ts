import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

const VALID_TRANSITIONS: Record<string, string[]> = {
  registered: ["assigned", "confirmed", "cancelled"],
  assigned: ["confirmed", "cancelled"],
  confirmed: ["attended", "no_show", "cancelled"],
  attended: [],
  no_show: [],
  cancelled: [],
};

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();
    const { status } = await req.json();

    const registration = await Registration.findById(id);
    if (!registration) {
      return NextResponse.json(
        { message: "Registration not found" },
        { status: 404 }
      );
    }

    const allowed = VALID_TRANSITIONS[registration.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          message: `Cannot transition from ${registration.status} to ${status}`,
        },
        { status: 400 }
      );
    }

    registration.status = status;
    await registration.save();

    return NextResponse.json({ message: "Status updated", registration });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
