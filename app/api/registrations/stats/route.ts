import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();

    const [total, byStatus] = await Promise.all([
      Registration.countDocuments(),
      Registration.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts: Record<string, number> = {};
    byStatus.forEach((s: any) => {
      statusCounts[s._id] = s.count;
    });

    return NextResponse.json({ total, byStatus: statusCounts });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
