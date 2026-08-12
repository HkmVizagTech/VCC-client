import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer, Event, Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();

    const [
      totalVolunteers,
      activeEvents,
      totalRegistrations,
      statusBreakdown,
      recentRegistrations,
      skillsDistribution,
    ] = await Promise.all([
      Volunteer.countDocuments(),
      Event.countDocuments({
        status: { $in: ["registration_open", "ongoing"] },
      }),
      Registration.countDocuments(),
      Registration.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Registration.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Volunteer.aggregate([
        { $unwind: "$skills" },
        { $group: { _id: "$skills", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    statusBreakdown.forEach((s: any) => {
      statusMap[s._id] = s.count;
    });

    return NextResponse.json({
      totalVolunteers,
      activeEvents,
      totalRegistrations,
      assigned: statusMap.assigned || 0,
      attended: statusMap.attended || 0,
      recentRegistrations,
      skillsDistribution,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
