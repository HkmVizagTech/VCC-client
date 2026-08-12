import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

// Any registered volunteer can be checked in (attendance is recorded even for
// unassigned volunteers — services can be assigned afterwards). `attended` and
// `no_show` can be undone to fix venue mistakes (e.g. wrong phone at check-in).
const VALID_TRANSITIONS: Record<string, string[]> = {
  registered: ["assigned", "attended", "no_show", "cancelled"],
  assigned: ["attended", "no_show", "cancelled"],
  attended: ["no_show", "assigned"],
  no_show: ["attended", "assigned"],
  cancelled: [],
};

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    // Service coordinators manage their team's attendance at the venue.
    const auth = await authenticateWithRole(req, "service_coordinator");
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
