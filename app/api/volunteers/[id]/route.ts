import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();

    const volunteer = await Volunteer.findById(id);
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

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();
    const body = await req.json();

    delete body.phone;
    delete body.volunteerNumber;

    const volunteer = await Volunteer.findByIdAndUpdate(id, body, {
      new: true,
    });
    if (!volunteer) {
      return NextResponse.json(
        { message: "Volunteer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Volunteer updated", volunteer });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
