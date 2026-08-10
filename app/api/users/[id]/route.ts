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
    const { name, phone, email } = await req.json();

    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (email) updates.email = email.toLowerCase();

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
    }).select("-password");

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "User updated", user });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "super_admin");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (user.role === "super_admin") {
      return NextResponse.json(
        { message: "Cannot delete super admin" },
        { status: 403 }
      );
    }

    await User.findByIdAndDelete(id);
    return NextResponse.json({ message: "User deleted" });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
