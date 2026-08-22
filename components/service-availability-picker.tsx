"use client";

import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import type { IDaySlots } from "@/lib/models/event.model";

export interface ServiceAvailabilityEntry {
  date: string;
  startTime: string;
  endTime: string;
}

function slotLabel(s: { startTime: string; endTime: string; label?: string }) {
  return s.label || `${s.startTime} – ${s.endTime}`;
}

export function serviceAvailabilitySummary(
  entries?: ServiceAvailabilityEntry[]
): string {
  if (!entries || entries.length === 0) return "";
  return entries
    .map((e) => {
      const dateLabel = e.date
        ? format(new Date(`${e.date}T00:00:00`), "MMM d")
        : "";
      const timeLabel = `${e.startTime}–${e.endTime}`;
      return dateLabel ? `${dateLabel}: ${timeLabel}` : timeLabel;
    })
    .join(" · ");
}

export function availableOn(
  entries: ServiceAvailabilityEntry[] | undefined,
  date: string,
  startTime: string,
  endTime: string
): boolean {
  if (!entries || entries.length === 0) return false;
  return entries.some(
    (e) => e.date === date && e.startTime === startTime && e.endTime === endTime
  );
}

export function ServiceAvailabilityPicker({
  daySlots,
  value,
  onChange,
}: {
  daySlots: IDaySlots[];
  value: ServiceAvailabilityEntry[];
  onChange: (value: ServiceAvailabilityEntry[]) => void;
}) {
  const isSelected = (date: string, startTime: string, endTime: string) =>
    value.some(
      (e) =>
        e.date === date && e.startTime === startTime && e.endTime === endTime
    );

  const toggleSlot = (date: string, startTime: string, endTime: string) => {
    if (isSelected(date, startTime, endTime)) {
      onChange(
        value.filter(
          (e) =>
            !(
              e.date === date &&
              e.startTime === startTime &&
              e.endTime === endTime
            )
        )
      );
    } else {
      onChange([...value, { date, startTime, endTime }]);
    }
  };

  if (daySlots.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>Availability</Label>
      <p className="text-xs text-muted-foreground">
        Select the time slots you are available for.
      </p>
      <div className="space-y-2">
        {daySlots.map((day) => (
          <div key={day.date} className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">
              {format(new Date(`${day.date}T00:00:00`), "EEEE, MMMM d")}
            </p>
            <div className="flex flex-wrap gap-2">
              {day.slots.map((slot) => {
                const active = isSelected(
                  day.date,
                  slot.startTime,
                  slot.endTime
                );
                return (
                  <button
                    key={`${slot.startTime}-${slot.endTime}`}
                    type="button"
                    onClick={() =>
                      toggleSlot(day.date, slot.startTime, slot.endTime)
                    }
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-transparent text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {slotLabel(slot)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
