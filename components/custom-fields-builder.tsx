"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

export type CustomFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "email"
  | "phone"
  | "select"
  | "radio"
  | "checkbox"
  | "date";

export interface CustomFieldDef {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
}

const TYPE_LABELS: Record<CustomFieldType, string> = {
  short_text: "Short Text",
  long_text: "Long Text (paragraph)",
  number: "Number",
  email: "Email",
  phone: "Phone",
  select: "Dropdown",
  radio: "Single Choice (radio)",
  checkbox: "Multiple Choice (checkboxes)",
  date: "Date",
};

const TYPES_WITH_OPTIONS: CustomFieldType[] = ["select", "radio", "checkbox"];

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

interface Props {
  value: CustomFieldDef[];
  onChange: (fields: CustomFieldDef[]) => void;
}

export function CustomFieldsBuilder({ value, onChange }: Props) {
  const updateField = useCallback(
    (idx: number, patch: Partial<CustomFieldDef>) => {
      const next = [...value];
      next[idx] = { ...next[idx], ...patch };
      if (patch.type && !TYPES_WITH_OPTIONS.includes(patch.type)) {
        delete next[idx].options;
      }
      if (patch.type && TYPES_WITH_OPTIONS.includes(patch.type) && !next[idx].options) {
        next[idx].options = [""];
      }
      onChange(next);
    },
    [value, onChange]
  );

  const removeField = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addField = () => {
    onChange([
      ...value,
      {
        id: makeId(),
        label: "",
        type: "short_text",
        required: false,
      },
    ]);
  };

  const updateOption = (fieldIdx: number, optIdx: number, val: string) => {
    const opts = [...(value[fieldIdx].options || [])];
    opts[optIdx] = val;
    updateField(fieldIdx, { options: opts });
  };

  const addOption = (fieldIdx: number) => {
    const opts = [...(value[fieldIdx].options || []), ""];
    updateField(fieldIdx, { options: opts });
  };

  const removeOption = (fieldIdx: number, optIdx: number) => {
    const opts = (value[fieldIdx].options || []).filter((_, i) => i !== optIdx);
    updateField(fieldIdx, { options: opts });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Custom Registration Questions</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Add extra questions volunteers must answer while registering for this event.
        </p>
      </div>

      {value.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No custom questions yet.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((field, idx) => {
            const needsOptions = TYPES_WITH_OPTIONS.includes(field.type);
            return (
              <div
                key={field.id}
                className="rounded-md border bg-muted/20 p-3 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-2 flex flex-col text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr,180px]">
                      <div className="space-y-1">
                        <Label className="text-xs">Question</Label>
                        <Input
                          value={field.label}
                          onChange={(e) =>
                            updateField(idx, { label: e.target.value })
                          }
                          placeholder="e.g. Do you have a vehicle?"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(v) => {
                            if (v) updateField(idx, { type: v as CustomFieldType });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map(
                              (t) => (
                                <SelectItem key={t} value={t}>
                                  {TYPE_LABELS[t]}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {!needsOptions && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Placeholder{" "}
                          <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          value={field.placeholder || ""}
                          onChange={(e) =>
                            updateField(idx, { placeholder: e.target.value })
                          }
                          placeholder="Hint shown inside the input"
                        />
                      </div>
                    )}

                    {needsOptions && (
                      <div className="space-y-2">
                        <Label className="text-xs">Options</Label>
                        {(field.options || []).map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <Input
                              value={opt}
                              onChange={(e) =>
                                updateOption(idx, oIdx, e.target.value)
                              }
                              placeholder={`Option ${oIdx + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOption(idx, oIdx)}
                              title="Remove option"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(idx)}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add option
                        </Button>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">
                        Help Text{" "}
                        <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        value={field.helpText || ""}
                        onChange={(e) =>
                          updateField(idx, { helpText: e.target.value })
                        }
                        placeholder="Extra explanation shown below the field"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={(v) =>
                            updateField(idx, { required: Boolean(v) })
                          }
                        />
                        Required
                      </label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveField(idx, -1)}
                          disabled={idx === 0}
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveField(idx, 1)}
                          disabled={idx === value.length - 1}
                          title="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(idx)}
                          title="Remove question"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addField}>
        <Plus className="mr-2 h-4 w-4" />
        Add question
      </Button>
    </div>
  );
}
