const PHONE_REGEX = /^\d{10}$/;

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(normalizePhone(phone));
}

export function validatePhone(phone: unknown): { ok: true; phone: string } | { ok: false; message: string } {
  if (!phone || typeof phone !== "string") {
    return { ok: false, message: "Phone number is required" };
  }
  const cleaned = normalizePhone(phone);
  if (!PHONE_REGEX.test(cleaned)) {
    return { ok: false, message: "Phone number must be exactly 10 digits" };
  }
  return { ok: true, phone: cleaned };
}
