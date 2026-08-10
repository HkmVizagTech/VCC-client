import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    if (!q) {
      return NextResponse.json({ volunteers: [] });
    }

    const regex = new RegExp(q, "i");
    const volunteers = await Volunteer.find({
      $or: [{ name: regex }, { phone: regex }],
    }).limit(10);

    return NextResponse.json({ volunteers });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
