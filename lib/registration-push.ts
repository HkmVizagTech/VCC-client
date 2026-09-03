// ─── Folding a repeat push into an existing registration ────────────────────
// The Vaikuntham app's backend exports one row per (volunteer, day), so a
// volunteer serving several days of a festival arrives as several POSTs to the
// same endpoint. Only the first of them creates anything; the rest describe the
// SAME registration and must be folded into it.
//
// Both push endpoints (/api/events/public/:eventId/register and
// /api/registrations) share this so they can never drift apart — a fix applied
// to one and not the other is how the second day gets lost again.

import type { IRegistration } from "@/lib/models/registration.model";
import {
  mergeServiceAvailability,
  type ServiceAvailabilityEntry,
} from "@/lib/utils/service-availability";
import type { NormalizedAnswer } from "@/lib/utils/custom-fields";

export interface PushMergeInput {
  /** Slots this push carries, already normalized. */
  availability: ServiceAvailabilityEntry[];
  /** Custom answers this push carries, already validated (partial is fine). */
  answers?: NormalizedAnswer[];
  notes?: unknown;
}

export interface PushMergeResult {
  changed: boolean;
  /** Slots that were genuinely new — what the response reports back. */
  added: ServiceAvailabilityEntry[];
}

/**
 * Fold a push into a registration that already exists, in place.
 *
 * What it deliberately does NOT touch:
 *   - `status` — a coordinator who cancelled or assigned this registration made
 *     a decision the app has no business overwriting from a data sync.
 *   - `serviceId` — same reason; the assignment is ours.
 *   - existing availability — the merge is additive (see
 *     lib/utils/service-availability.ts).
 */
export function mergePushIntoRegistration(
  registration: Pick<
    IRegistration,
    "serviceAvailability" | "customAnswers" | "notes"
  >,
  input: PushMergeInput
): PushMergeResult {
  let changed = false;

  const { merged, added } = mergeServiceAvailability(
    registration.serviceAvailability,
    input.availability
  );
  if (added.length > 0) {
    registration.serviceAvailability = merged;
    changed = true;
  }

  // Answers are merged per field, not replaced: a later row is often slimmer
  // than the first one, and a payload that omits a field must not erase the
  // answer the volunteer actually gave.
  if (input.answers && input.answers.length > 0) {
    const byField = new Map(
      (registration.customAnswers || []).map((a) => [a.fieldId, a])
    );
    for (const answer of input.answers) {
      const current = byField.get(answer.fieldId);
      if (
        !current ||
        JSON.stringify(current.value) !== JSON.stringify(answer.value) ||
        current.label !== answer.label ||
        current.type !== answer.type
      ) {
        byField.set(answer.fieldId, answer);
        changed = true;
      }
    }
    if (changed) {
      registration.customAnswers = Array.from(byField.values());
    }
  }

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes && !registration.notes) {
    registration.notes = notes;
    changed = true;
  }

  return { changed, added };
}
