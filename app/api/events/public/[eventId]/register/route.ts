import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Volunteer, Registration } from "@/lib/models";
import { validatePhone } from "@/lib/utils/phone";
import { validateAndNormalizeAnswers } from "@/lib/utils/custom-fields";
import { applyVolunteerProfile } from "@/lib/utils/volunteer-profile";
import { parseServiceAvailability } from "@/lib/utils/service-availability";
import { mergePushIntoRegistration } from "@/lib/registration-push";

type Params = { params: Promise<{ eventId: string }> };

/**
 * The name and phone under any of the spellings the callers use.
 *
 * The website form sends `name`/`phone`, the app's user module sends
 * `phone_number`, and the seva-sheet exporter sends `mobile_number` /
 * `volunteer_mobile_number` (the same key their assign-seva API uses). All
 * three mean the volunteer, so all three are accepted rather than making the
 * Vaikuntham team reshape rows before pushing them.
 *
 * `devotee_mobile_number` is deliberately NOT read here — that is the devotee
 * who brought the volunteer in, not the volunteer.
 */
function readIdentity(body: Record<string, unknown>) {
  return {
    name: body.name ?? body.volunteer_name ?? body.volunteerName,
    phone:
      body.phone ??
      body.phone_number ??
      body.mobile_number ??
      body.mobileNumber ??
      body.volunteer_mobile_number ??
      body.volunteerMobileNumber,
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    await connectDB();

    const body = (await req.json()) as Record<string, unknown>;
    const { name, phone } = readIdentity(body);
    const customAnswers = body.customAnswers ?? body.custom_answers;
    // Coerced here so a non-string `notes` from a hand-rolled payload cannot
    // fail the schema cast on an otherwise valid push.
    const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;

    // Must be a real string: the name is what overwrites the stored volunteer
    // below, and a blank or non-string one would leave a new document without
    // the field the schema requires — a 500 where a 400 belongs.
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "Name is required" },
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

    const event = await Event.findOne({ eventId: eventId.toUpperCase() });
    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    // The app owns the volunteer's identity, not VCC.
    //
    // We find the volunteer by phone, and a phone number is not a person: it
    // gets shared, lent and reassigned between events. So whatever the app
    // sends now REPLACES what we hold — otherwise a number first registered
    // years ago as "Radha" keeps showing that name for whoever uses it today.
    // Fields the payload doesn't carry are left alone; see
    // lib/utils/volunteer-profile.ts.
    const profile = { ...body, name } as Parameters<
      typeof applyVolunteerProfile
    >[1];

    // ─── Availability slots ──────────────────────────────────────────────
    // Read before the branch below because both paths need them, and snapped
    // onto the event's configured slots so a pushed slot and an admin-picked
    // one are byte-identical. Accepts the documented `serviceAvailability`
    // array AND a bare row (`date` + `start_time`/`end_time`/`label`), which
    // is what the seva-sheet exporter sends — see
    // lib/utils/service-availability.ts.
    const availability = parseServiceAvailability(body, event.availabilitySlots);

    let volunteer = await Volunteer.findOne({ phone: phoneResult.phone });

    // ─── A repeat push is an UPDATE, not a duplicate ─────────────────────
    // The Vaikuntham backend exports one row per (volunteer, day), so a
    // volunteer serving the 4th and the 5th arrives as two POSTs. This used to
    // answer the second one 409 "Already registered for this event" and throw
    // it away — VCC showed the volunteer for the 4th only, with nothing to
    // indicate a 5th had ever been sent.
    //
    // So: find the existing registration first and fold the push into it.
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

      // Partial validation: a later row is often slimmer than the first, and
      // `"<label>" is required` on a push whose only job is to add a day would
      // lose that day. The first row's answers are already stored and were
      // validated in full.
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

      // 200, not 409. The push succeeded — it is the same registration with
      // one more day on it. Answering with an error status made their backend
      // treat a correct sync as a failed one and retry it forever.
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
            dateOfBirth: volunteer.dateOfBirth || null,
            photoKey: volunteer.photoKey,
          },
        },
        { status: 200 }
      );
    }

    // ─── A genuinely new registration ────────────────────────────────────
    // The registration window is checked HERE and not above on purpose: it
    // exists to stop new sign-ups after the deadline, and applying it to a
    // merge would drop the extra day of somebody who registered in time.
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
        // A concurrent row for the same number created the volunteer between
        // our lookup and this save (phone is unique). Take theirs.
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
      // Two rows for the same volunteer can be in flight at once — the export
      // is pushed as a batch. Both passed the lookup above, and the loser of
      // the race trips the unique (eventId, volunteerId) index. Merge into the
      // winner instead of answering 409, or a concurrent batch loses days the
      // sequential case now keeps.
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
            dateOfBirth: volunteer.dateOfBirth || null,
            photoKey: volunteer.photoKey,
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
          dateOfBirth: volunteer.dateOfBirth || null,
          photoKey: volunteer.photoKey,
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
