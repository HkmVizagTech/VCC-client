// ─── Availability slots pushed by the Vaikuntham app ────────────────────────
// The community app does not push a registration once with every slot on it.
// Its backend exports one ROW PER (volunteer, day) — the same shape as the
// seva sheet its admins work in:
//
//   event_id  name       mobile_number  date        start_time  end_time  label
//   SKJV26    M Bharath  8886176475     04-09-2026  06:00:00    21:00:00  06:00 - 21:00
//   SKJV26    M Bharath  8886176475     05-09-2026  06:00:00    21:00:00  06:00 - 21:00
//
// so a volunteer serving both days arrives as two POSTs. The first created the
// registration; the second used to come back 409 "Already registered for this
// event" and the second day was simply LOST — VCC showed the volunteer on the
// 4th only, and no coordinator could tell that a 5th had ever been sent.
//
// This module is the parsing half of the fix (the routes do the merging):
//
//   - it accepts the row's own field names as well as the documented
//     `serviceAvailability` array, so their backend can push rows verbatim
//   - it normalizes `04-09-2026` → `2026-09-04` and `06:00:00` → `06:00`,
//     because the event's configured slots are stored in those forms and the
//     admin screens match availability by exact string equality
//     (see components/service-availability-picker.tsx → availableOn)
//   - it snaps a parsed entry onto the event's own configured slot when one
//     matches, so a slot typed by an admin and a slot pushed by the app end up
//     byte-identical rather than merely equivalent
//
// Nothing here throws or rejects: an unparseable row yields no entries rather
// than a 400, because a bad `start_time` must never cost us a volunteer's
// registration.

import type { IDaySlots } from "@/lib/models/event.model";

export interface ServiceAvailabilityEntry {
  date: string;
  startTime: string;
  endTime: string;
}

/** A trimmed non-empty string, or undefined. */
function text(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * An event-day key as `yyyy-MM-dd`, from whatever the app sent.
 *
 * Accepts `2026-09-04`, `04-09-2026`, `04/09/2026`, `2026/09/04` and full ISO
 * instants. Two-part-ambiguous values like `04-09-2026` are read DAY-first:
 * that is what the sheet uses and what an Indian admin types. A US-style
 * `09/04/2026` meaning 4 September would therefore be read as 9 April — so if
 * the app ever switches to that format it must send ISO instead.
 */
export function normalizeDateKey(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? undefined
      : new Date(value.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  }

  const raw = text(value);
  if (!raw) return undefined;

  // Already a key, or an ISO instant that starts with one.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(raw);
  if (iso) {
    // A value carrying a zone or a time is an instant, not a key: read it in
    // IST so 2026-09-03T18:30:00Z (midnight in India) is the 4th, not the 3rd.
    if (/[T ]/.test(raw)) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
      }
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const parts = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(raw);
  if (!parts) return undefined;

  const [, a, b, c] = parts;
  let year: number, month: number, day: number;

  if (a.length === 4) {
    // yyyy-MM-dd with single-digit parts, e.g. 2026-9-4
    year = Number(a);
    month = Number(b);
    day = Number(c);
  } else if (c.length === 4) {
    // dd-MM-yyyy — the sheet's format. Day first unless it cannot be a day.
    year = Number(c);
    if (Number(a) > 12 && Number(b) <= 12) {
      day = Number(a);
      month = Number(b);
    } else if (Number(b) > 12 && Number(a) <= 12) {
      // Unambiguously MM-dd-yyyy.
      month = Number(a);
      day = Number(b);
    } else {
      day = Number(a);
      month = Number(b);
    }
  } else {
    return undefined;
  }

  if (!(year >= 2000 && year <= 2100)) return undefined;
  if (!(month >= 1 && month <= 12)) return undefined;
  if (!(day >= 1 && day <= 31)) return undefined;

  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Reject 31 February and friends rather than storing a day that isn't real.
  const check = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== key) {
    return undefined;
  }
  return key;
}

/**
 * A slot time as `HH:MM`, from `06:00:00`, `6:00`, `06:00`, `6 AM`, `18:30`.
 *
 * `HH:MM` is what the event form stores, and the admin screens compare slot
 * times as strings — so `06:00:00` from the app would silently never match the
 * `06:00` an admin configured.
 */
export function normalizeTime(value: unknown): string | undefined {
  const raw = text(value)?.toUpperCase();
  if (!raw) return undefined;

  const m = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?$/.exec(raw);
  if (!m) return undefined;

  let hour = Number(m[1]);
  const minute = m[2] === undefined ? 0 : Number(m[2]);
  const meridiem = m[4];

  if (meridiem) {
    if (hour < 1 || hour > 12) return undefined;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  }

  // 24:00 is a legitimate way to say "midnight at the end of the day", which a
  // festival programme running past midnight does produce.
  if (hour === 24 && minute === 0) return "24:00";
  if (hour < 0 || hour > 23) return undefined;
  if (minute < 0 || minute > 59) return undefined;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "06:00 - 21:00", "06:00–21:00", "6 AM to 9 PM" → the two ends. */
function splitLabel(value: unknown): { startTime: string; endTime: string } | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const parts = raw.split(/\s*(?:-|–|—|to|till|until)\s*/i);
  if (parts.length !== 2) return undefined;
  const startTime = normalizeTime(parts[0]);
  const endTime = normalizeTime(parts[1]);
  return startTime && endTime ? { startTime, endTime } : undefined;
}

function canonical(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The dedupe identity of one availability entry. */
export function availabilityKey(entry: ServiceAvailabilityEntry): string {
  return `${entry.date}|${entry.startTime}|${entry.endTime}`;
}

/**
 * Replace a parsed entry with the event's own configured slot when they mean
 * the same window, so pushed and admin-picked slots are byte-identical.
 *
 * Also fills in the times when the app sent only a day (or only a label) and
 * that day has exactly one configured slot — the common case for this festival,
 * where every day is a single 06:00–21:00 window.
 */
function snapToEventSlot(
  entry: { date: string; startTime?: string; endTime?: string; label?: string },
  daySlots: IDaySlots[] | undefined
): ServiceAvailabilityEntry | undefined {
  const day = (daySlots || []).find((d) => normalizeDateKey(d.date) === entry.date);
  const slots = day?.slots || [];

  if (entry.startTime && entry.endTime) {
    const match = slots.find(
      (s) =>
        normalizeTime(s.startTime) === entry.startTime &&
        normalizeTime(s.endTime) === entry.endTime
    );
    if (match) {
      return { date: day!.date, startTime: match.startTime, endTime: match.endTime };
    }
    // No configured counterpart — keep what the app sent. The event may have no
    // slots configured at all, and a real pushed window is worth more than a
    // tidy one.
    return { date: entry.date, startTime: entry.startTime, endTime: entry.endTime };
  }

  if (entry.label) {
    const wanted = canonical(entry.label);
    const match = slots.find(
      (s) =>
        (s.label && canonical(s.label) === wanted) ||
        canonical(`${s.startTime} - ${s.endTime}`) === wanted
    );
    if (match) {
      return { date: day!.date, startTime: match.startTime, endTime: match.endTime };
    }
  }

  if (slots.length === 1) {
    return {
      date: day!.date,
      startTime: slots[0].startTime,
      endTime: slots[0].endTime,
    };
  }

  return undefined;
}

type RawEntry = Record<string, unknown>;

function readEntry(raw: unknown): { date?: string; startTime?: string; endTime?: string; label?: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as RawEntry;

  const date = normalizeDateKey(
    e.date ?? e.day ?? e.event_date ?? e.eventDate ?? e.seva_date ?? e.sevaDate
  );
  if (!date) return undefined;

  const label = text(e.label ?? e.timeSlot ?? e.time_slot ?? e.slot ?? e.slot_label);
  let startTime = normalizeTime(e.startTime ?? e.start_time ?? e.from ?? e.fromTime ?? e.from_time);
  let endTime = normalizeTime(e.endTime ?? e.end_time ?? e.to ?? e.toTime ?? e.to_time);

  // A label like "06:00 - 21:00" carries the window when the fields don't.
  if (!startTime || !endTime) {
    const fromLabel = splitLabel(label);
    if (fromLabel) {
      startTime = startTime || fromLabel.startTime;
      endTime = endTime || fromLabel.endTime;
    }
  }

  return { date, startTime, endTime, label };
}

/**
 * Every availability entry a push carries, normalized and snapped.
 *
 * Reads, in order of preference:
 *   1. `serviceAvailability` / `service_availability` / `availability` / `slots`
 *      — an array (or a single object) of entries, the documented shape
 *   2. the top-level row itself — `date` + `start_time`/`end_time`/`label`,
 *      which is what the seva sheet's exporter sends
 *
 * Entries that cannot be read are dropped, and the result is deduped.
 */
export function parseServiceAvailability(
  payload: Record<string, unknown>,
  daySlots?: IDaySlots[]
): ServiceAvailabilityEntry[] {
  const source =
    payload.serviceAvailability ??
    payload.service_availability ??
    payload.availability ??
    payload.slots ??
    payload.timeSlots ??
    payload.time_slots;

  let rows: unknown[];
  if (Array.isArray(source)) {
    rows = source;
  } else if (source && typeof source === "object") {
    rows = [source];
  } else {
    // The row IS the entry — one POST per (volunteer, day).
    rows = [payload];
  }

  const out: ServiceAvailabilityEntry[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const read = readEntry(row);
    if (!read?.date) continue;
    const snapped = snapToEventSlot(
      { date: read.date, startTime: read.startTime, endTime: read.endTime, label: read.label },
      daySlots
    );
    if (!snapped) continue;
    const key = availabilityKey(snapped);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(snapped);
  }

  return out;
}

/**
 * Merge pushed slots into what the registration already holds.
 *
 * Additive on purpose: a push is one row of a multi-row export, so it says
 * "also this day", never "only this day". Replacing here would make the last
 * row pushed the only day the volunteer appears for — the same data loss as
 * the 409 it replaces, just quieter.
 *
 * Returns the merged list plus the entries that were genuinely new, so the
 * route can report whether the push changed anything and skip a pointless
 * write when it didn't.
 */
export function mergeServiceAvailability(
  existing: ServiceAvailabilityEntry[] | undefined,
  incoming: ServiceAvailabilityEntry[]
): { merged: ServiceAvailabilityEntry[]; added: ServiceAvailabilityEntry[] } {
  const merged = (existing || []).map((e) => ({
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
  }));
  const seen = new Set(merged.map(availabilityKey));
  const added: ServiceAvailabilityEntry[] = [];

  for (const entry of incoming) {
    const key = availabilityKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
    added.push(entry);
  }

  // Chronological, so the admin screens and the summary string read in order
  // regardless of which row the app happened to push first.
  merged.sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date)
  );

  return { merged, added };
}
