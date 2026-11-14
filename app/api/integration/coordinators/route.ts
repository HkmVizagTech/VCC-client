import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { authenticateIntegration } from "@/lib/integration-auth";

// GET /api/integration/coordinators
// Active coordinators, for the QR admin dashboard's pickers. Events can be
// owned by super_admin / event_coordinator; services by any of the three.
export async function GET(req: NextRequest) {
  const denied = authenticateIntegration(req);
  if (denied) return denied;

  try {
    await connectDB();
    const users = await User.find({
      role: { $in: ["super_admin", "event_coordinator", "service_coordinator"] },
      status: "active",
    })
      .select("name email phone role")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      coordinators: users.map((u) => ({
        _id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Server error" }, { status: 500 });
  }
}
