import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { hashPassword } from "@/lib/utils/password";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "super_admin");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { name, email, phone, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { message: "Name, email, password, and role are required" },
        { status: 400 }
      );
    }

    if (role === "super_admin") {
      return NextResponse.json(
        { message: "Cannot create super admin via API" },
        { status: 403 }
      );
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { message: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role,
    });

    const userObj = user.toObject();
    const { password: _, ...userWithoutPassword } = userObj;

    return NextResponse.json(
      { message: "User created successfully", user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
