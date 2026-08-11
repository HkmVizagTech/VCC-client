import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Devotee } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function GET() {
  try {
    await connectDB();
    const devotees = await Devotee.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ devotees });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { name, phone, notes } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    const devotee = await Devotee.create({
      name: name.trim(),
      phone: phone?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });

    return NextResponse.json({ devotee }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
