"use client";

import { Label } from "@/components/ui/label";
import { format, eachDayOfInterval } from "date-fns";

export interface ServiceAvailabilityEntry {
  date: string;
  timeSlot: string;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export function serviceAvailabilitySummary(
  entries?: ServiceAvailabilityEntry[]
): string {
  if (!entries || entries.length === 0) return "";
  return entries
    .map(
      (e) =>
        `${format(new Date(`${e.date}T00:00:00`), "MMM d")}: ${e.timeSlot}`
    )
    .join(" · ");
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

  const selectSlot = (date: string, timeSlot: string) => {
    const next = value.filter((e) => e.date !== date);
    next.push({ date, timeSlot });
    onChange(next);
  };

  if (slots.length === 0) return null;

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
