import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Devotee } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();
    const { name, phone, notes } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    const devotee = await Devotee.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        phone: phone?.trim() || undefined,
        notes: notes?.trim() || undefined,
      },
      { new: true }
    );

    if (!devotee) {
      return NextResponse.json({ message: "Devotee not found" }, { status: 404 });
    }

    return NextResponse.json({ devotee });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();

    const devotee = await Devotee.findByIdAndDelete(id);
    if (!devotee) {
      return NextResponse.json({ message: "Devotee not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Deleted" });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
