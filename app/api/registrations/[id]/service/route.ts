import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Registration, Service, Volunteer, Event } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { syncAssignSeva } from "@/lib/community-sync";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await connectDB();
    const { serviceId } = await req.json();

    const registration = await Registration.findById(id);
    if (!registration) {
      return NextResponse.json(
        { message: "Registration not found" },
        { status: 404 }
      );
    }

    registration.serviceId = serviceId;
    if (serviceId && registration.status === "registered") {
      registration.status = "assigned";
    }
    await registration.save();

    if (serviceId) {
      const [service, volunteer, event] = await Promise.all([
        Service.findById(serviceId, "name"),
        Volunteer.findById(registration.volunteerId, "phone"),
        Event.findById(registration.eventId, "eventId"),
      ]);
      if (service && volunteer && event) {
        syncAssignSeva(event.eventId, service.name, volunteer.phone);
      }
    }

    return NextResponse.json({
      message: "Service assigned",
      registration,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
