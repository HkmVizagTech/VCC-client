import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "super_admin");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();
    const { status } = await req.json();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (user.role === "super_admin") {
      return NextResponse.json(
        { message: "Cannot change super admin status" },
        { status: 403 }
      );
    }

    user.status = status;
    await user.save();

    const userObj = user.toObject();
    const { password: _, ...userWithoutPassword } = userObj;

    return NextResponse.json({
      message: "Status updated",
      user: userWithoutPassword,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
