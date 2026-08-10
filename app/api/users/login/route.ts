import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { comparePassword } from "@/lib/utils/password";
import { generateToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { message: "Account is deactivated. Contact admin." },
        { status: 403 }
      );
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = generateToken({ userId: user._id.toString(), role: user.role });

    const userObj = user.toObject();
    const { password: _, ...userWithoutPassword } = userObj;

    const response = NextResponse.json({
      message: "Login successful",
      token,
      user: userWithoutPassword,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
