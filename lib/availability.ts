export const AVAILABILITY_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const AVAILABILITY_SLOTS = [
  "morning",
  "afternoon",
  "evening",
] as const;

export type AvailabilityDay = (typeof AVAILABILITY_DAYS)[number];
export type AvailabilitySlot = (typeof AVAILABILITY_SLOTS)[number];
