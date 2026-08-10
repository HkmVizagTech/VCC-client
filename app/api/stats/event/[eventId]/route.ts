import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Registration, Service } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "service_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { eventId } = await params;
    await connectDB();

    const [statusBreakdown, serviceFill] = await Promise.all([
      Registration.aggregate([
        { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Service.aggregate([
        { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
        {
          $lookup: {
            from: "registrations",
            let: { serviceId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$serviceId", "$$serviceId"] },
                },
              },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            as: "registrationStats",
          },
        },
        {
          $project: {
            name: 1,
            requiredVolunteers: 1,
            registrationStats: 1,
          },
        },
      ]),
    ]);

    return NextResponse.json({ statusBreakdown, serviceFill });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
