"use client";

import { Label } from "@/components/ui/label";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_SLOTS,
} from "@/lib/availability";

export type AvailabilityValue = {
  days: string[];
  timeSlots: string[];
};

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const SLOT_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-transparent text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}

export function AvailabilityPicker({
  value,
  onChange,
}: {
  value: AvailabilityValue;
  onChange: (value: AvailabilityValue) => void;
}) {
  const toggle = (key: "days" | "timeSlots", item: string) => {
    const list = value[key];
    const next = list.includes(item)
      ? list.filter((i) => i !== item)
      : [...list, item];
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Available Days</Label>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_DAYS.map((day) => (
            <Chip
              key={day}
              label={DAY_LABELS[day]}
              active={value.days.includes(day)}
              onClick={() => toggle("days", day)}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Available Time Slots</Label>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_SLOTS.map((slot) => (
            <Chip
              key={slot}
              label={SLOT_LABELS[slot]}
              active={value.timeSlots.includes(slot)}
              onClick={() => toggle("timeSlots", slot)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function availabilitySummary(value?: AvailabilityValue): string {
  if (!value || (value.days.length === 0 && value.timeSlots.length === 0))
    return "";
  const days = value.days.map((d) => DAY_LABELS[d] || d).join(", ");
  const slots = value.timeSlots.map((s) => SLOT_LABELS[s] || s).join(", ");
  return [days, slots].filter(Boolean).join(" — ");
}
