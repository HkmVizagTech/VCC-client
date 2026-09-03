import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Event, Volunteer, Registration } from "@/lib/models";
import { validateAndNormalizeAnswers } from "@/lib/utils/custom-fields";
import { validatePhone } from "@/lib/utils/phone";
import { applyVolunteerProfile } from "@/lib/utils/volunteer-profile";
import { parseServiceAvailability } from "@/lib/utils/service-availability";
import { mergePushIntoRegistration } from "@/lib/registration-push";

/**
 * The event this push is for, by Mongo `_id` OR by short event code.
 *
 * This endpoint was documented as the `_id` form, but the seva-sheet exporter
 * sends the code its own sheet carries (`event_id: "SKJV26"`), and
 * `findById("SKJV26")` throws a CastError — a 500 that reads like our bug and
 * tells the caller nothing. Accept both.
 */
async function findEvent(raw: unknown) {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return null;
  if (mongoose.isValidObjectId(id)) {
    const byId = await Event.findById(id);
    if (byId) return byId;
  }
  return Event.findOne({ eventId: id.toUpperCase() });
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;

    const name = body.name ?? body.volunteer_name ?? body.volunteerName;
    const phone =
      body.phone ??
      body.phone_number ??
      body.mobile_number ??
      body.mobileNumber ??
      body.volunteer_mobile_number ??
      body.volunteerMobileNumber;
    const customAnswers = body.customAnswers ?? body.custom_answers;
    // Coerced here so a non-string `notes` from a hand-rolled payload cannot
    // fail the schema cast on an otherwise valid push.
    const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;

    const eventRef = body.eventId ?? body.event_id;

    if (!eventRef || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "eventId and name are required" },
        { status: 400 }
      );
    }

    const phoneResult = validatePhone(phone);
    if (!phoneResult.ok) {
      return NextResponse.json(
        { message: phoneResult.message },
        { status: 400 }
      );
    }

    const event = await findEvent(eventRef);
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    const profile = { ...body, name } as Parameters<
      typeof applyVolunteerProfile
    >[1];
    const availability = parseServiceAvailability(body, event.availabilitySlots);

    let volunteer = await Volunteer.findOne({ phone: phoneResult.phone });

    // A repeat push is the same registration with another day on it, not a
    // duplicate — see the long note in
    // app/api/events/public/[eventId]/register/route.ts. Both endpoints must
    // behave identically or the second day is lost on whichever one the app
    // happens to call.
    const existingReg = volunteer
      ? await Registration.findOne({
          eventId: event._id,
          volunteerId: volunteer._id,
        })
      : null;

    if (existingReg && volunteer) {
      if (applyVolunteerProfile(volunteer, profile)) {
        await volunteer.save();
      }

      const answerResult = validateAndNormalizeAnswers(
        event.customFields,
        customAnswers,
        { partial: true }
      );

      const { changed, added } = mergePushIntoRegistration(existingReg, {
        availability,
        answers: answerResult.ok ? answerResult.answers : [],
        notes,
      });
      if (changed) await existingReg.save();

      return NextResponse.json(
        {
          message: added.length
            ? "Registration updated — availability merged"
            : "Already registered for this event",
          merged: true,
          addedAvailability: added,
          registration: existingReg,
          volunteer: {
            _id: volunteer._id,
            name: volunteer.name,
            phone: volunteer.phone,
          },
        },
        { status: 200 }
      );
    }

    // New registration — the registration window applies here only, so a
    // merge for somebody who signed up in time still lands after the deadline.
    if (event.status !== "registration_open") {
      return NextResponse.json(
        { message: "Registration is not open for this event" },
        { status: 400 }
      );
    }

    if (event.registrationEnd && new Date() > new Date(event.registrationEnd)) {
      return NextResponse.json(
        { message: "Registration deadline has passed" },
        { status: 400 }
      );
    }

    const answerResult = validateAndNormalizeAnswers(
      event.customFields,
      customAnswers
    );
    if (!answerResult.ok) {
      return NextResponse.json(
        { message: answerResult.message },
        { status: 400 }
      );
    }

    if (!volunteer) {
      const fresh = new Volunteer({ phone: phoneResult.phone, skills: [] });
      applyVolunteerProfile(fresh, profile);
      try {
        await fresh.save();
        volunteer = fresh;
      } catch (error: unknown) {
        if ((error as { code?: number }).code !== 11000) throw error;
        volunteer = await Volunteer.findOne({ phone: phoneResult.phone });
        if (!volunteer) throw error;
      }
    } else if (applyVolunteerProfile(volunteer, profile)) {
      await volunteer.save();
    }

    let registration;
    try {
      registration = await Registration.create({
        eventId: event._id,
        volunteerId: volunteer._id,
        serviceAvailability: availability,
        customAnswers: answerResult.answers,
        notes,
      });
    } catch (error: unknown) {
      // Batch pushes race each other; the loser merges into the winner rather
      // than reporting a conflict.
      if ((error as { code?: number }).code !== 11000) throw error;

      const winner = await Registration.findOne({
        eventId: event._id,
        volunteerId: volunteer._id,
      });
      if (!winner) throw error;

      const { changed, added } = mergePushIntoRegistration(winner, {
        availability,
        answers: answerResult.answers,
        notes,
      });
      if (changed) await winner.save();

      return NextResponse.json(
        {
          message: "Registration updated — availability merged",
          merged: true,
          addedAvailability: added,
          registration: winner,
          volunteer: {
            _id: volunteer._id,
            name: volunteer.name,
            phone: volunteer.phone,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: "Registration successful",
        registration,
        volunteer: {
          _id: volunteer._id,
          name: volunteer.name,
          phone: volunteer.phone,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
