"use client";

import { Label } from "@/components/ui/label";
import { format, eachDayOfInterval } from "date-fns";

export interface ServiceAvailabilityEntry {
  date: string;
  timeSlot: string;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const MONTH_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const ORDINAL_DATE_PATTERN = /\b\d{1,2}(st|nd|rd|th)\b/i;

function slotsAreDateSpecific(slots: string[]): boolean {
  return slots.some(
    (s) => MONTH_PATTERN.test(s) || ORDINAL_DATE_PATTERN.test(s)
  );
}

export function serviceAvailabilitySummary(
  entries?: ServiceAvailabilityEntry[]
): string {
  if (!entries || entries.length === 0) return "";
  return entries
    .map((e) =>
      e.date
        ? `${format(new Date(`${e.date}T00:00:00`), "MMM d")}: ${e.timeSlot}`
        : e.timeSlot
    )
    .join(" · ");
}

export function availableOn(
  entries: ServiceAvailabilityEntry[] | undefined,
  date: string,
  timeSlot: string
): boolean {
  if (!entries || entries.length === 0) return false;
  return entries.some((e) => e.date === date && e.timeSlot === timeSlot);
}

export function ServiceAvailabilityPicker({
  start,
  end,
  slots,
  value,
  onChange,
}: {
  start: Date;
  end: Date;
  slots: string[];
  value: ServiceAvailabilityEntry[];
  onChange: (value: ServiceAvailabilityEntry[]) => void;
}) {
  const days = eachDayOfInterval({ start, end });
  const dateSpecific = slotsAreDateSpecific(slots);

  const selectSlot = (date: string, timeSlot: string) => {
    const next = value.filter((e) => e.date !== date);
    next.push({ date, timeSlot });
    onChange(next);
  };

  const toggleFlatSlot = (slot: string) => {
    const exists = value.some((e) => e.timeSlot === slot);
    if (exists) {
      onChange(value.filter((e) => e.timeSlot !== slot));
    } else {
      onChange([...value, { date: "", timeSlot: slot }]);
    }
  };

  if (slots.length === 0) return null;

  if (dateSpecific) {
    return (
      <div className="space-y-2">
        <Label>Availability</Label>
        <p className="text-xs text-muted-foreground">
          Select the slots you are available for.
        </p>
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => {
            const active = value.some((e) => e.timeSlot === slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => toggleFlatSlot(slot)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent text-muted-foreground hover:bg-accent"
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Availability</Label>
      <p className="text-xs text-muted-foreground">
        Select the time slot you are available for each day.
      </p>
      <div className="space-y-2">
        {days.map((day) => {
          const key = dayKey(day);
          const selected = value.find((e) => e.date === key)?.timeSlot || "";
          return (
            <div key={key} className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">
                {format(day, "EEEE, MMMM d")}
              </p>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => {
                  const active = selected === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => selectSlot(key, slot)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-transparent text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
