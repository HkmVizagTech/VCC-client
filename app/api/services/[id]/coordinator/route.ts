import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Service } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();
    const { coordinatorId } = await req.json();

    const service = await Service.findByIdAndUpdate(
      id,
      { coordinatorId },
      { new: true }
    ).populate("coordinatorId", "name email");

    if (!service) {
      return NextResponse.json(
        { message: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Coordinator assigned", service });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
