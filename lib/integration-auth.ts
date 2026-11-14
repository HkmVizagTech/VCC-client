import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

// Machine-to-machine auth for the QR Seva Pass backend.
//
// The QR backend is the source of truth for events: an event created there is
// pushed here so nobody has to type it twice. It authenticates with a shared
// secret in QR_INTEGRATION_KEY, sent as `X-API-Key: <key>` or
// `Authorization: Bearer <key>`.
//
// When QR_INTEGRATION_KEY is not set the integration routes are disabled
// (503) rather than open.

function digest(value: string): Buffer {
  // Hash both sides so timingSafeEqual always compares equal-length buffers.
  return createHash("sha256").update(value).digest();
}

export function authenticateIntegration(req: NextRequest): NextResponse | null {
  const expected = process.env.QR_INTEGRATION_KEY;
  if (!expected) {
    return NextResponse.json(
      { message: "QR integration is not configured on this server" },
      { status: 503 }
    );
  }

  const header = req.headers.get("x-api-key") || "";
  const bearer = req.headers.get("authorization") || "";
  const provided = header || (bearer.startsWith("Bearer ") ? bearer.slice(7) : "");

  if (!provided || !timingSafeEqual(digest(provided), digest(expected))) {
    return NextResponse.json({ message: "Invalid integration key" }, { status: 401 });
  }
  return null;
}
