// ─── Event date audit ───────────────────────────────────────────────────────
// Prints every event's stored start/end as IST wall-clock time next to the
// attendance days VCC derives from them, and flags the ones that do not match
// what the admin meant.
//
// This exists because a stored instant and an attendance day are different
// things, and the gap between them was invisible. An event entered as
// "29–31 August" was stored ending 1 Sep 05:17 IST — five and a half hours
// late, from the era when the event form's offset-less datetime-local values
// were parsed as UTC — and VCC therefore counted FOUR attendance days. Nothing
// surfaced that until a volunteer's badge read "Attended 1/4".
//
// Usage (from vcc-client/):
//
//   npx tsx scripts/check-event-days.ts
//       Audit every event. Read-only.
//
//   npx tsx scripts/check-event-days.ts --fix TSTF --start 2026-08-29 --end 2026-08-31
//       Rewrite ONE event's start/end to 01:00 and 23:00 IST of the given
//       calendar dates — the times the event form itself defaults to, which
//       produce exactly one attendance day per calendar day.
//
// Only eventStart and eventEnd are touched. Registration open/close may carry
// the same historical shift, but nothing derives days from them, so they are
// reported and left alone.

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { eventDayKeys, istWallClock } from "../lib/utils/event-days";

// The connection string lives in .env.local for `next dev`; fall back to .env
// and to a plain environment variable so this runs anywhere.
for (const file of [".env.local", ".env"]) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI not set (looked in .env.local, .env, environment)");
  process.exit(1);
}

const IST = (value?: Date | string | null) => {
  const d = istWallClock(value);
  if (!d) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

/** A `yyyy-MM-dd` IST calendar date at a given IST hour, as a real instant. */
function istInstant(day: string, time: string): Date {
  const parsed = new Date(`${day}T${time}:00.000+05:30`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Not a valid date: ${day} ${time}`);
  }
  return parsed;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  await mongoose.connect(MONGO_URI!);
  const events = mongoose.connection.collection("events");

  const fixId = arg("fix");
  if (fixId) {
    const start = arg("start");
    const end = arg("end");
    if (!start || !end) {
      console.error(
        "--fix needs --start yyyy-MM-dd and --end yyyy-MM-dd (the opening and closing calendar dates)"
      );
      process.exit(1);
    }
    const eventStart = istInstant(start, "01:00");
    const eventEnd = istInstant(end, "23:00");
    const days = eventDayKeys(eventStart, eventEnd);
    if (days.length === 0) {
      console.error("That range yields no attendance days — check the dates.");
      process.exit(1);
    }

    const result = await events.updateOne(
      { eventId: fixId.toUpperCase() },
      { $set: { eventStart, eventEnd, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      console.error(`No event with eventId ${fixId.toUpperCase()}`);
      process.exit(1);
    }
    console.log(
      `${fixId.toUpperCase()}: ${IST(eventStart)} → ${IST(eventEnd)} IST` +
        `\n  ${days.length} attendance day(s): ${days.join(", ")}`
    );
    console.log(
      "\nNote: volunteers' serviceAvailability rows for a day that no longer" +
        "\nexists are left as they are — they are harmless, and removing one" +
        "\nwould silently drop a slot someone actually picked."
    );
    await mongoose.disconnect();
    return;
  }

  const all = await events
    .find({}, { projection: { eventId: 1, name: 1, eventStart: 1, eventEnd: 1, registrationStart: 1, registrationEnd: 1 } })
    .sort({ eventStart: -1 })
    .toArray();

  console.log(`${all.length} event(s)\n`);
  for (const event of all) {
    const days = eventDayKeys(event.eventStart, event.eventEnd);
    const startIst = istWallClock(event.eventStart);
    const endIst = istWallClock(event.eventEnd);

    // The form's own convention. Anything else is not wrong by itself — a
    // programme really can run 06:00 to 22:00 — but a start after 01:00 with
    // an end past 01:00 the next morning is the shape that adds a phantom day.
    const notes: string[] = [];
    if (endIst && endIst.getHours() < 1) {
      notes.push("ends before 01:00 — counts as the previous day (intended)");
    }
    if (startIst && endIst && startIst.getMinutes() === endIst.getMinutes() && startIst.getMinutes() !== 0) {
      notes.push(
        `both times end at :${String(startIst.getMinutes()).padStart(2, "0")} — looks like the old +5:30 datetime-local shift`
      );
    }

    console.log(`${event.eventId}  ${event.name}`);
    console.log(`  starts : ${IST(event.eventStart)} IST`);
    console.log(`  ends   : ${IST(event.eventEnd)} IST`);
    console.log(`  reg    : ${IST(event.registrationStart)} → ${IST(event.registrationEnd)} IST`);
    console.log(`  days   : ${days.length} → ${days.join(", ") || "none"}`);
    for (const note of notes) console.log(`  ⚠  ${note}`);
    console.log("");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
