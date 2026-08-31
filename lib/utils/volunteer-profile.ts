// ─── Volunteer profile from the Vaikuntham app ──────────────────────────────
// VCC identifies a volunteer by phone number, and a phone number is NOT a
// stable identity for a person. Numbers are shared within a family, handed to
// a friend so they can register, and change hands between festivals. The
// Vaikuntham app is where the volunteer actually typed their own name, so
// whatever it sends for a number is the current truth about who holds it.
//
// Before this existed, the FIRST name ever stored won forever: the public
// register route looked the volunteer up by phone and reused the existing
// document untouched. Someone registering through the app as "Chaitanya" was
// shown to every coordinator, every attendance sheet and every report as
// "Radha" — the name attached to that number at some earlier event.
//
// The rules this encodes:
//   - the app's name always wins, whenever it sends one
//   - every other field is refreshed only when the app sends a usable value;
//     a field the payload omits (or sends blank) keeps what VCC already has,
//     so a minimal payload can never wipe a filled-in profile
//   - enum fields are dropped unless the value is one the schema accepts, so a
//     junk `gender` can never turn a registration into a 500

import { VOLUNTEER_SKILLS } from "@/lib/models/volunteer.model";

/** The subset of a volunteer document this helper writes to. */
export interface VolunteerProfileTarget {
  name?: string;
  dateOfBirth?: Date;
  age?: number;
  gender?: string;
  locality?: string;
  occupation?: string;
  occupationType?: string;
  institution?: string;
  company?: string;
  skills?: string[];
  photoKey?: string;
  notes?: string;
}

/** Anything the app might send. Deliberately `unknown` — this is wire data. */
export type VolunteerProfilePayload = {
  name?: unknown;
  dateOfBirth?: unknown;
  date_of_birth?: unknown;
  age?: unknown;
  gender?: unknown;
  locality?: unknown;
  occupation?: unknown;
  occupationType?: unknown;
  occupation_type?: unknown;
  institution?: unknown;
  company?: unknown;
  skills?: unknown;
  photoKey?: unknown;
  photo_key?: unknown;
  notes?: unknown;
};

const GENDERS = ["male", "female", "other"];
const OCCUPATION_TYPES = ["student", "working"];

/** A trimmed non-empty string, or undefined — blank is treated as "not sent". */
function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Copy whatever the app sent onto a volunteer document, in place.
 *
 * Returns true when something actually changed, so callers can skip a save
 * that would write nothing. Safe to call on a brand-new document as well as an
 * existing one — the create path uses it too, so both paths validate input
 * identically.
 */
export function applyVolunteerProfile(
  volunteer: VolunteerProfileTarget,
  payload: VolunteerProfilePayload
): boolean {
  let changed = false;

  // The name is the whole point: it is overwritten, not filled in.
  const name = text(payload.name);
  if (name && volunteer.name !== name) {
    volunteer.name = name;
    changed = true;
  }

  const dobRaw = payload.dateOfBirth ?? payload.date_of_birth;
  if (typeof dobRaw === "string" || dobRaw instanceof Date) {
    const dob = new Date(dobRaw);
    if (!Number.isNaN(dob.getTime())) {
      const current = volunteer.dateOfBirth
        ? new Date(volunteer.dateOfBirth).getTime()
        : null;
      if (current !== dob.getTime()) {
        volunteer.dateOfBirth = dob;
        changed = true;
      }
    }
  }

  const ageRaw =
    typeof payload.age === "number" ? payload.age : Number(text(payload.age));
  if (Number.isFinite(ageRaw) && ageRaw > 0 && volunteer.age !== ageRaw) {
    volunteer.age = ageRaw;
    changed = true;
  }

  const gender = text(payload.gender)?.toLowerCase();
  if (gender && GENDERS.includes(gender) && volunteer.gender !== gender) {
    volunteer.gender = gender;
    changed = true;
  }

  const occupationType = text(
    payload.occupationType ?? payload.occupation_type
  )?.toLowerCase();
  if (
    occupationType &&
    OCCUPATION_TYPES.includes(occupationType) &&
    volunteer.occupationType !== occupationType
  ) {
    volunteer.occupationType = occupationType;
    changed = true;
  }

  const setText = (
    key: "locality" | "occupation" | "institution" | "company" | "photoKey" | "notes",
    raw: unknown
  ) => {
    const value = text(raw);
    if (value && volunteer[key] !== value) {
      volunteer[key] = value;
      changed = true;
    }
  };

  setText("locality", payload.locality);
  setText("occupation", payload.occupation);
  setText("institution", payload.institution);
  setText("company", payload.company);
  setText("photoKey", payload.photoKey ?? payload.photo_key);
  setText("notes", payload.notes);

  if (Array.isArray(payload.skills)) {
    const allowed = VOLUNTEER_SKILLS as readonly string[];
    const skills = payload.skills
      .map((s) => text(s))
      .filter((s): s is string => !!s && allowed.includes(s));
    // An empty list is "not sent", not "clear my skills" — the app omits the
    // field on the lighter payloads and that must not erase what we hold.
    if (skills.length && (volunteer.skills || []).join("|") !== skills.join("|")) {
      volunteer.skills = skills;
      changed = true;
    }
  }

  return changed;
}
