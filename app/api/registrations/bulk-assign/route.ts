import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Registration } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { registrationIds, serviceId } = await req.json();

    if (!registrationIds?.length || !serviceId) {
      return NextResponse.json(
        { message: "registrationIds and serviceId are required" },
        { status: 400 }
      );
    }

    const objectIds = registrationIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );
    const serviceObjectId = new mongoose.Types.ObjectId(serviceId);

    const result = await Registration.updateMany(
      { _id: { $in: objectIds } },
      [
        {
          $set: {
            serviceId: serviceObjectId,
            status: {
              $cond: {
                if: { $eq: ["$status", "registered"] },
                then: "assigned",
                else: "$status",
              },
            },
          },
        },
      ]
    );

    return NextResponse.json({
      message: `${result.modifiedCount} registrations updated`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
