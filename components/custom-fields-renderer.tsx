"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";
import { API_URL } from "@/lib/api";
import type { CustomFieldDef } from "./custom-fields-builder";

export type CustomFieldValue = string | string[] | number | undefined;

export type CustomFieldAnswers = Record<string, CustomFieldValue>;

interface Devotee {
  _id: string;
  name: string;
}

interface Props {
  fields: CustomFieldDef[];
  values: CustomFieldAnswers;
  onChange: (values: CustomFieldAnswers) => void;
}

export function CustomFieldsRenderer({ fields, values, onChange }: Props) {
  const [devotees, setDevotees] = useState<Devotee[]>([]);
  const [devoteeSearch, setDevoteeSearch] = useState<Record<string, string>>({});

  const hasDevoteeField = fields.some((f) => f.type === "devotee_select");

  useEffect(() => {
    if (!hasDevoteeField) return;
    fetch(`${API_URL}/api/devotees`)
      .then((r) => r.ok ? r.json() : { devotees: [] })
      .then((d) => setDevotees(d.devotees || []))
      .catch(() => {});
  }, [hasDevoteeField]);

  if (!fields || fields.length === 0) return null;

  const setValue = (id: string, val: CustomFieldValue) => {
    onChange({ ...values, [id]: val });
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = values[field.id];
        const isImportant = field.important;
        const effectiveRequired = field.required || isImportant;

        return (
          <div
            key={field.id}
            className={`space-y-2 ${isImportant ? "rounded-md border border-amber-400/50 bg-amber-50/30 p-3 dark:bg-amber-950/10" : ""}`}
          >
            <Label className="flex items-center gap-1.5">
              {isImportant && (
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
              )}
              {field.label}
              {effectiveRequired && <span className="ml-0.5 text-destructive">*</span>}
            </Label>

            {field.type === "short_text" && (
              <Input
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={effectiveRequired}
              />
            )}

            {field.type === "long_text" && (
              <Textarea
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={effectiveRequired}
              />
            )}

            {field.type === "number" && (
              <Input
                type="number"
                value={value === undefined ? "" : String(value)}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={effectiveRequired}
              />
            )}

            {field.type === "email" && (
              <Input
                type="email"
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={effectiveRequired}
              />
            )}

            {field.type === "phone" && (
              <Input
                type="tel"
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={effectiveRequired}
              />
            )}

            {field.type === "date" && (
              <Input
                type="date"
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={effectiveRequired}
              />
            )}

            {field.type === "select" && (
              <Select
                value={(value as string) || null}
                onValueChange={(v) => {
                  if (v) setValue(field.id, v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {(field.options || []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === "radio" && (
              <div className="flex flex-col gap-2">
                {(field.options || []).map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={value === opt}
                      onChange={() => setValue(field.id, opt)}
                      required={effectiveRequired}
                      className="h-4 w-4"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {field.type === "checkbox" && (
              <div className="flex flex-col gap-2">
                {(field.options || []).map((opt) => {
                  const arr = Array.isArray(value) ? (value as string[]) : [];
                  const checked = arr.includes(opt);
                  return (
                    <label
                      key={opt}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const isOn = Boolean(v);
                          const next = isOn
                            ? [...arr, opt]
                            : arr.filter((x) => x !== opt);
                          setValue(field.id, next);
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}

            {field.type === "devotee_select" && (
              <DevoteeMultiSelect
                fieldId={field.id}
                devotees={devotees}
                value={Array.isArray(value) ? (value as string[]) : []}
                onChange={(names) => setValue(field.id, names)}
                search={devoteeSearch[field.id] || ""}
                onSearchChange={(q) =>
                  setDevoteeSearch((prev) => ({ ...prev, [field.id]: q }))
                }
              />
            )}

            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DevoteeMultiSelectProps {
  fieldId: string;
  devotees: Devotee[];
  value: string[];
  onChange: (names: string[]) => void;
  search: string;
  onSearchChange: (q: string) => void;
}

function DevoteeMultiSelect({
  devotees,
  value,
  onChange,
  search,
  onSearchChange,
}: DevoteeMultiSelectProps) {
  const filtered = devotees.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (name: string) => {
    const next = value.includes(name)
      ? value.filter((n) => n !== name)
      : [...value, name];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search devotees..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
        {devotees.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Loading devotees...</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No devotees found.</p>
        ) : (
          filtered.map((d) => {
            const checked = value.includes(d.name);
            return (
              <label
                key={d._id}
                className="flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 text-sm last:border-0 hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(d.name)}
                />
                {d.name}
              </label>
            );
          })
        )}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected: {value.join(", ")}
        </p>
      )}
    </div>
  );
}
