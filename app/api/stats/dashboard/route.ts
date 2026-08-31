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
      upcomingEvents,
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
      Event.find({
        status: { $in: ["ongoing", "registration_open", "registration_closed"] },
      })
        .sort({ eventStart: 1 })
        .limit(6)
        .lean(),
    ]);

    // Get registration counts for each upcoming event
    const eventIds = upcomingEvents.map((e: any) => e._id);
    const regCounts = await Registration.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      { $group: { _id: "$eventId", count: { $sum: 1 } } },
    ]);
    const regCountMap: Record<string, number> = {};
    regCounts.forEach((r: any) => {
      regCountMap[r._id.toString()] = r.count;
    });
    const eventsWithCounts = upcomingEvents.map((e: any) => ({
      _id: e._id,
      eventId: e.eventId,
      name: e.name,
      status: e.status,
      eventStart: e.eventStart,
      eventEnd: e.eventEnd,
      venue: e.venue,
      registrationCount: regCountMap[e._id.toString()] || 0,
    }));

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
      upcomingEvents: eventsWithCounts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
