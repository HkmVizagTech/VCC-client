import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Event, Service, User, EVENT_STATUSES } from "@/lib/models";
import { sanitizeCustomFields } from "@/lib/utils/custom-fields";
import { authenticateIntegration } from "@/lib/integration-auth";
import { normalizeEventDates } from "@/lib/utils/event-days";

// Event sync from the QR Seva Pass backend.
//
// QR is the source of truth for an event's identity (code, name, dates,
// venue). One event code is shared by QR, VCC and the Vaikuntham app, so the
// URL segment IS the VCC eventId.
//
//   GET /api/integration/events/:code  → { exists, event }
//   PUT /api/integration/events/:code  → create, or update the shared fields
//
// On UPDATE only the fields QR owns are overwritten. VCC-only settings
// (coordinator, registration window, photo rule, status, time slots, custom
// fields, services) are managed in VCC and changed only when the body
// explicitly carries them.
//
// `services` is add-or-update by name: listed services are created, or their
// description / requiredVolunteers updated. Services are never deleted from
// here — volunteers may already be assigned to them.

type Ctx = { params: Promise<{ code: string }> };

const SHARED_FIELDS = ["name", "description", "venue", "bannerImage", "eventStart", "eventEnd"] as const;
const VCC_FIELDS = ["registrationStart", "registrationEnd", "photoRequired", "status", "coordinatorId"] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Same shape the VCC admin form saves: [{ date, slots: [{ startTime, endTime, label }] }]
function sanitizeSlots(input: unknown) {
  if (!Array.isArray(input)) return [];
  const days = new Map<string, { startTime: string; endTime: string; label?: string }[]>();
  for (const day of input as any[]) {
    if (!day || typeof day.date !== "string" || !DATE_RE.test(day.date)) continue;
    const slots = (Array.isArray(day.slots) ? day.slots : [])
      .filter((s: any) => s && TIME_RE.test(s.startTime) && TIME_RE.test(s.endTime))
      .slice(0, 4)
      .map((s: any) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        ...(typeof s.label === "string" && s.label.trim() ? { label: s.label.trim() } : {}),
      }));
    if (slots.length) days.set(day.date, slots);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({ date, slots }));
}

type ServiceInput = { name: string; description?: string; requiredVolunteers?: number; coordinatorId?: string };

function sanitizeServices(input: unknown): ServiceInput[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ServiceInput[] = [];
  for (const s of input as any[]) {
    const name = typeof s?.name === "string" ? s.name.trim() : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const n = Number(s.requiredVolunteers);
    out.push({
      name,
      description: typeof s.description === "string" ? s.description.trim() : undefined,
      requiredVolunteers: Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined,
      coordinatorId: s.coordinatorId ? String(s.coordinatorId) : undefined,
    });
  }
  return out;
}

async function isCoordinator(id: string) {
  return (
    mongoose.isValidObjectId(id) &&
    !!(await User.exists({
      _id: id,
      role: { $in: ["super_admin", "event_coordinator", "service_coordinator"] },
      status: "active",
    }))
  );
}

// Adds new services / updates existing ones (matched by name). Returns a summary.
async function upsertServices(eventObjectId: unknown, eventCoordinatorId: unknown, services: ServiceInput[]) {
  const summary = { created: 0, updated: 0, errors: [] as string[] };
  for (const s of services) {
    const existing = await Service.findOne({ eventId: eventObjectId, name: s.name });
    if (existing) {
      if (s.description !== undefined) existing.description = s.description;
      if (s.requiredVolunteers !== undefined) existing.requiredVolunteers = s.requiredVolunteers;
      await existing.save();
      summary.updated++;
      continue;
    }
    const coordinatorId = s.coordinatorId || String(eventCoordinatorId);
    if (s.coordinatorId && !(await isCoordinator(s.coordinatorId))) {
      summary.errors.push(`${s.name}: coordinator not found`);
      continue;
    }
    try {
      await Service.create({
        eventId: eventObjectId,
        name: s.name,
        description: s.description,
        requiredVolunteers: s.requiredVolunteers ?? 0,
        coordinatorId,
      });
      summary.created++;
    } catch (e: any) {
      summary.errors.push(`${s.name}: ${e.message}`);
    }
  }
  return summary;
}

function normCode(raw: string) {
  return decodeURIComponent(raw || "").trim().toUpperCase();
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = authenticateIntegration(req);
  if (denied) return denied;

  try {
    await connectDB();
    const code = normCode((await params).code);
    const event = await Event.findOne({ eventId: code })
      .populate("coordinatorId", "name email phone")
      .lean();
    return NextResponse.json({ exists: !!event, event: event || null });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const denied = authenticateIntegration(req);
  if (denied) return denied;

  try {
    await connectDB();
    const code = normCode((await params).code);
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      return NextResponse.json({ message: "Invalid event code" }, { status: 400 });
    }

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ message: "JSON body required" }, { status: 400 });
    }
    const body = normalizeEventDates(raw as Record<string, unknown>);

    const update: Record<string, unknown> = {};
    for (const f of SHARED_FIELDS) if (body[f] !== undefined) update[f] = body[f];
    for (const f of VCC_FIELDS) if (body[f] !== undefined && body[f] !== "") update[f] = body[f];
    if (body.availabilitySlots !== undefined) update.availabilitySlots = sanitizeSlots(body.availabilitySlots);
    if (body.customFields !== undefined) update.customFields = sanitizeCustomFields(body.customFields);
    const services = body.services !== undefined ? sanitizeServices(body.services) : [];

    if (update.status !== undefined && !EVENT_STATUSES.includes(update.status as any)) {
      return NextResponse.json({ message: `Invalid status "${update.status}"` }, { status: 400 });
    }
    // Same people VCC's own event form offers: event and service coordinators
    // (and super_admin, which the admin API also accepts).
    if (update.coordinatorId !== undefined) {
      const id = String(update.coordinatorId);
      const ok = await isCoordinator(id);
      if (!ok) {
        return NextResponse.json({ message: "Coordinator not found or inactive" }, { status: 400 });
      }
    }

    const existing = await Event.findOne({ eventId: code });

    const start = new Date((update.eventStart ?? existing?.eventStart) as any);
    const end = new Date((update.eventEnd ?? existing?.eventEnd) as any);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      return NextResponse.json({ message: "eventEnd must be after eventStart" }, { status: 400 });
    }

    update.qrSyncedAt = new Date();

    if (!existing) {
      if (!update.name || !update.eventStart || !update.eventEnd) {
        return NextResponse.json(
          { message: "name, eventStart and eventEnd are required to create an event" },
          { status: 400 }
        );
      }
      if (!update.coordinatorId) {
        return NextResponse.json(
          { message: "coordinatorId is required to create an event in VCC" },
          { status: 400 }
        );
      }
      const event = await Event.create({ ...update, eventId: code });
      const servicesResult = services.length
        ? await upsertServices(event._id, event.coordinatorId, services)
        : undefined;
      return NextResponse.json(
        { message: "Event created", created: true, event, services: servicesResult },
        { status: 201 }
      );
    }

    existing.set(update);
    await existing.save();
    const servicesResult = services.length
      ? await upsertServices(existing._id, existing.coordinatorId, services)
      : undefined;
    return NextResponse.json({ message: "Event updated", created: false, event: existing, services: servicesResult });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ message: "An event with this code already exists" }, { status: 409 });
    }
    if (error.name === "ValidationError" || error.name === "CastError") {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Server error" }, { status: 500 });
  }
}
