import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "super_admin");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const status = searchParams.get("status");

    const filter: Record<string, string> = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
