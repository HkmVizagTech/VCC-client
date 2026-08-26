// ─── Community app sync (harekrishnavizag.co.in) ────────────────────────────
// Pushes seva assignments and attendance to the mobile team's Laravel API.
//
// Their stack is header-sensitive in TWO independent ways, and getting either
// wrong looks identical from our side (a non-JSON response) while looking like
// "you never called us" from theirs:
//
//   1. User-Agent — a ModSecurity WAF sits in front of Laravel and returns 406
//      for requests without a browser-like agent. That rejection happens BEFORE
//      the request reaches their application, so nothing appears in their logs.
//
//   2. Accept — Laravel decides HTML-vs-JSON error rendering from the *Accept*
//      header ($request->expectsJson()), NOT from Content-Type. Without
//      `Accept: application/json`, a validation failure comes back as a
//      rendered HTML error page instead of a JSON body. Content-Type only
//      describes what we are SENDING; Accept declares what we want BACK.
//
// DELIVERY (why after() and not a bare fire-and-forget call):
// On Vercel the serverless function is FROZEN the instant the handler returns
// its response. A promise still in flight is suspended there — it resumes only
// if that same container happens to be invoked again, which in practice meant
// syncs landing minutes late, or dying with ECONNRESET when the TLS socket was
// torn down mid-handshake, or never completing at all. `after()` (Next 15.1+,
// backed by Vercel's waitUntil) keeps the function alive until the work
// settles, WITHOUT making the scanner wait for the response.
//
// Config: COMMUNITY_APP_API_URL — accepted either as the bare origin
// (https://harekrishnavizag.co.in) or with the full API path already appended.

import { after } from "next/server";

const API_PATH = "/api/v1/user/festivals";

// Cap a single attempt so a hung request can't hold the function open to its
// execution limit, and allow one retry for transient socket failures.
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 750;

const BASE_URL = (() => {
  const raw = (process.env.COMMUNITY_APP_API_URL || "https://harekrishnavizag.co.in")
    .trim()
    .replace(/\/+$/, "");
  // Tolerate the env var being set to just the origin — otherwise the POST
  // lands on a path Laravel doesn't route and we get its HTML 404 page back.
  return raw.includes(API_PATH) ? raw : `${raw}${API_PATH}`;
})();

const COMMON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; ISKCON-SevaPass/1.0; +https://harekrishnavizag.org)",
};

async function deliver(endpoint: string, body: Record<string, string>) {
  const url = `${BASE_URL}/${endpoint}`;
  const who = body.volunteer_mobile_number || "?";
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const tag = attempt === 2 ? " (retry)" : "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: COMMON_HEADERS,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const text = await res.text().catch(() => "");
      const contentType = res.headers.get("content-type") || "";
      const looksHtml =
        /html/i.test(contentType) || /^\s*<(!doctype|html)/i.test(text);

      if (!res.ok || looksHtml) {
        // An HTTP-level rejection is their answer, not a glitch — do not retry
        // it, or a 422 becomes two identical 422s in the log.
        console.error(
          `[community-sync] ${endpoint} FAILED for ${who} → HTTP ${res.status}${tag}` +
            (looksHtml
              ? " — got an HTML page, not JSON (WAF block or unrouted URL)."
              : "") +
            `\n  url: ${url}` +
            `\n  payload: ${JSON.stringify(body)}` +
            `\n  response: ${text.slice(0, 300)}`
        );
        return;
      }

      // Log successes too, with elapsed ms. Without this there is no way to
      // tell a sync that worked from one that silently never fired — and the
      // timing is what exposes delivery problems rather than API problems.
      console.log(
        `[community-sync] ${endpoint} OK for ${who} → event_id ${body.event_id}` +
          ` date ${body.date || "-"} in ${Date.now() - startedAt}ms${tag}: ${text.slice(0, 200)}`
      );
      return;
    } catch (err) {
      // Network/timeout failure. These are the transient ones worth one retry
      // (ECONNRESET, TLS handshake torn down, DNS blip).
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (attempt === 1) {
        console.warn(
          `[community-sync] ${endpoint} network error for ${who} — retrying in ${RETRY_DELAY_MS}ms: ${detail}`
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      console.error(
        `[community-sync] ${endpoint} request error for ${who} after 2 attempts: ${detail}` +
          `\n  url: ${url}\n  payload: ${JSON.stringify(body)}`
      );
    }
  }
}

function post(endpoint: string, body: Record<string, string>) {
  try {
    // Deferred to after the response is sent, but the runtime keeps the
    // function alive until it settles. See the DELIVERY note at the top.
    after(() => deliver(endpoint, body));
  } catch {
    // after() throws outside a request scope (scripts, tests). Fall back to a
    // plain call so those contexts still work.
    void deliver(endpoint, body);
  }
}

export function syncAssignSeva(
  eventId: string,
  serviceName: string,
  volunteerPhone: string,
  devoteePhone?: string
) {
  post("assign-seva", {
    service_name: serviceName,
    event_id: eventId,
    volunteer_mobile_number: volunteerPhone,
    devotee_mobile_number: devoteePhone || volunteerPhone,
  });
}

// `date` is the event day the attendance applies to, as `yyyy-MM-dd`.
// Their API rejects the call without it ("The date field is required"), and
// it is meaningful here: VCC tracks attendance per day, so the same volunteer
// is marked present on several distinct dates across one festival.
// Required (not optional) on purpose — a missing date must be a compile error,
// not a 422 discovered in production.
export function syncMarkAttendance(
  eventId: string,
  volunteerPhone: string,
  isPresent: boolean,
  date: string
) {
  post("mark-attendance", {
    event_id: eventId,
    volunteer_mobile_number: volunteerPhone,
    is_present: isPresent ? "yes" : "no",
    date,
  });
}
