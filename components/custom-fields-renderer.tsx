"use client";

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
import type { CustomFieldDef } from "./custom-fields-builder";

export type CustomFieldValue = string | string[] | number | undefined;

export type CustomFieldAnswers = Record<string, CustomFieldValue>;

interface Props {
  fields: CustomFieldDef[];
  values: CustomFieldAnswers;
  onChange: (values: CustomFieldAnswers) => void;
}

export function CustomFieldsRenderer({ fields, values, onChange }: Props) {
  if (!fields || fields.length === 0) return null;

  const setValue = (id: string, val: CustomFieldValue) => {
    onChange({ ...values, [id]: val });
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = values[field.id];
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>

            {field.type === "short_text" && (
              <Input
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}

            {field.type === "long_text" && (
              <Textarea
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}

            {field.type === "number" && (
              <Input
                type="number"
                value={value === undefined ? "" : String(value)}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}

            {field.type === "email" && (
              <Input
                type="email"
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}

            {field.type === "phone" && (
              <Input
                type="tel"
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}

            {field.type === "date" && (
              <Input
                type="date"
                value={(value as string) || ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
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
                      required={field.required}
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

            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
