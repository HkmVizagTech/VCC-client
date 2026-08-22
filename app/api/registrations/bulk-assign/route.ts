import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Registration, Service, Volunteer, Event, User } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { syncAssignSeva } from "@/lib/community-sync";

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

    if (result.modifiedCount > 0) {
      const [service, regs] = await Promise.all([
        Service.findById(serviceId, "name eventId coordinatorId"),
        Registration.find(
          { _id: { $in: objectIds } },
          "volunteerId eventId"
        ).populate("volunteerId", "phone"),
      ]);
      if (service) {
        const [event, coordinator] = await Promise.all([
          Event.findById(service.eventId, "eventId"),
          service.coordinatorId
            ? User.findById(service.coordinatorId, "phone")
            : null,
        ]);
        const devoteePhone = coordinator?.phone || undefined;
        if (event) {
          for (const reg of regs) {
            const vol = reg.volunteerId as unknown as { phone?: string };
            if (vol?.phone) {
              syncAssignSeva(event.eventId, service.name, vol.phone, devoteePhone);
            }
          }
        }
      }
    }

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
