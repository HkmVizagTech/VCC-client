import crypto from "crypto";
import {
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
  type ICustomField,
} from "@/lib/models/event.model";

const TYPES_WITH_OPTIONS: CustomFieldType[] = ["select", "radio", "checkbox"];

export function sanitizeCustomFields(input: unknown): ICustomField[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: ICustomField[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const type = item.type as CustomFieldType;
    if (!label) continue;
    if (!CUSTOM_FIELD_TYPES.includes(type)) continue;

    let id =
      typeof item.id === "string" && item.id.trim().length > 0
        ? item.id.trim()
        : crypto.randomBytes(6).toString("hex");
    while (seen.has(id)) id = crypto.randomBytes(6).toString("hex");
    seen.add(id);

    const field: ICustomField = {
      id,
      label,
      type,
      required: Boolean(item.required),
      important: Boolean(item.important),
      placeholder:
        typeof item.placeholder === "string" ? item.placeholder.trim() : undefined,
      helpText:
        typeof item.helpText === "string" ? item.helpText.trim() : undefined,
    };

    if (TYPES_WITH_OPTIONS.includes(type)) {
      const opts = Array.isArray(item.options)
        ? (item.options as unknown[])
            .map((o) => (typeof o === "string" ? o.trim() : ""))
            .filter((o) => o.length > 0)
        : [];
      if (opts.length === 0) continue;
      field.options = opts;
    }

    result.push(field);
  }

  return result;
}

export function validateAndNormalizeAnswers(
  fields: ICustomField[] | undefined,
  answers: unknown
): { ok: true; answers: Array<{ fieldId: string; label: string; type: string; value: unknown }> } | { ok: false; message: string } {
  const list = fields || [];
  if (list.length === 0) return { ok: true, answers: [] };

  const answerMap = new Map<string, unknown>();
  if (Array.isArray(answers)) {
    for (const a of answers as Array<{ fieldId?: string; value?: unknown }>) {
      if (a && typeof a === "object" && typeof a.fieldId === "string") {
        answerMap.set(a.fieldId, a.value);
      }
    }
  } else if (answers && typeof answers === "object") {
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      answerMap.set(k, v);
    }
  }

  const normalized: Array<{ fieldId: string; label: string; type: string; value: unknown }> = [];

  for (const field of list) {
    const raw = answerMap.get(field.id);
    const isEmpty =
      raw === undefined ||
      raw === null ||
      raw === "" ||
      (Array.isArray(raw) && raw.length === 0);

    if (isEmpty) {
      if (field.required || field.important) {
        return { ok: false, message: `"${field.label}" is required` };
      }
      continue;
    }

    let value: unknown = raw;

    if (field.type === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        return { ok: false, message: `"${field.label}" must be a number` };
      }
      value = n;
    } else if (field.type === "checkbox") {
      const arr = Array.isArray(raw) ? raw : [raw];
      const cleaned = arr
        .map((v) => (typeof v === "string" ? v : String(v)))
        .filter((v) => field.options?.includes(v));
      if ((field.required || field.important) && cleaned.length === 0) {
        return { ok: false, message: `"${field.label}" is required` };
      }
      value = cleaned;
    } else if (field.type === "devotee_select") {
      const arr = Array.isArray(raw) ? raw : [raw];
      const cleaned = arr
        .map((v) => (typeof v === "string" ? v.trim() : String(v)))
        .filter((v) => v.length > 0);
      if ((field.required || field.important) && cleaned.length === 0) {
        return { ok: false, message: `"${field.label}" is required` };
      }
      value = cleaned;
    } else if (field.type === "select" || field.type === "radio") {
      const str = typeof raw === "string" ? raw : String(raw);
      if (!field.options?.includes(str)) {
        return { ok: false, message: `"${field.label}" has an invalid option` };
      }
      value = str;
    } else if (field.type === "date") {
      const str = typeof raw === "string" ? raw : String(raw);
      if (Number.isNaN(new Date(str).getTime())) {
        return { ok: false, message: `"${field.label}" must be a valid date` };
      }
      value = str;
    } else {
      value = typeof raw === "string" ? raw.trim() : String(raw);
    }

    normalized.push({
      fieldId: field.id,
      label: field.label,
      type: field.type,
      value,
    });
  }

  return { ok: true, answers: normalized };
}
