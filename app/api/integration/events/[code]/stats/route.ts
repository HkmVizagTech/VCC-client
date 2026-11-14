import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Registration, Service } from "@/lib/models";
import { authenticateIntegration } from "@/lib/integration-auth";
import { eventDayKeys } from "@/lib/utils/event-days";

// GET /api/integration/events/:code/stats
// Volunteer numbers for one event, for display in the QR admin dashboard.
//   totals    — registrations by status (registered/assigned/attended/no_show/cancelled)
//   services  — per service: required vs assigned, and attended
//   days      — per event day: attended / no-show counts
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const denied = authenticateIntegration(req);
  if (denied) return denied;

  try {
    await connectDB();
    const code = decodeURIComponent((await params).code || "").trim().toUpperCase();
    const event = await Event.findOne({ eventId: code })
      .select("eventId name status eventStart eventEnd")
      .lean();
    if (!event) return NextResponse.json({ exists: false }, { status: 404 });

    const [byStatus, byService, byDay, services] = await Promise.all([
      Registration.aggregate([
        { $match: { eventId: event._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Registration.aggregate([
        { $match: { eventId: event._id, serviceId: { $ne: null }, status: { $ne: "cancelled" } } },
        {
          $group: {
            _id: "$serviceId",
            assigned: { $sum: 1 },
            attended: { $sum: { $cond: [{ $eq: ["$status", "attended"] }, 1, 0] } },
          },
        },
      ]),
      Registration.aggregate([
        { $match: { eventId: event._id } },
        { $unwind: "$dayAttendance" },
        {
          $group: {
            _id: { date: "$dayAttendance.date", status: "$dayAttendance.status" },
            count: { $sum: 1 },
          },
        },
      ]),
      Service.find({ eventId: event._id }).select("name requiredVolunteers status").sort({ name: 1 }).lean(),
    ]);

    const totals: Record<string, number> = {
      registered: 0,
      assigned: 0,
      attended: 0,
      no_show: 0,
      cancelled: 0,
    };
    for (const s of byStatus) totals[s._id] = s.count;
    const total = Object.values(totals).reduce((a, b) => a + b, 0);

    const svcMap = new Map(byService.map((s: any) => [String(s._id), s]));
    const serviceRows = services.map((s) => {
      const agg: any = svcMap.get(String(s._id));
      return {
        _id: String(s._id),
        name: s.name,
        status: s.status,
        requiredVolunteers: s.requiredVolunteers || 0,
        assigned: agg?.assigned || 0,
        attended: agg?.attended || 0,
      };
    });
    const unassigned = Math.max(
      0,
      total - totals.cancelled - serviceRows.reduce((a, s) => a + s.assigned, 0)
    );

    const dayMap = new Map<string, { attended: number; no_show: number }>();
    for (const d of eventDayKeys(event.eventStart, event.eventEnd)) {
      dayMap.set(d, { attended: 0, no_show: 0 });
    }
    for (const d of byDay as any[]) {
      const row = dayMap.get(d._id.date) || { attended: 0, no_show: 0 };
      row[d._id.status as "attended" | "no_show"] = d.count;
      dayMap.set(d._id.date, row);
    }
    const days = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    return NextResponse.json({
      exists: true,
      event: { eventId: event.eventId, name: event.name, status: event.status },
      total,
      totals,
      unassigned,
      services: serviceRows,
      days,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Server error" }, { status: 500 });
  }
}
