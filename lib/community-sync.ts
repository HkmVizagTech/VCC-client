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
// execution limit.
const REQUEST_TIMEOUT_MS = 15_000;

// Backoff between attempts. Vercel has no long-lived process, so "keep retrying
// every few seconds" has to happen inside one invocation: three attempts spread
// over roughly the first 5s catch the transient failures (WAF blip, ECONNRESET,
// TLS reset) without anyone noticing. Anything still failing after that is
// handed to the per-minute sweeper instead of being retried here forever.
const RETRY_BACKOFF_MS = [750, 4_000];
const DEFAULT_ATTEMPTS = 3;

/** Outcome of one push, with enough detail to store and show an admin. */
export type SyncResult = { ok: boolean; detail: string };

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

/** Pushes once, retrying only transient network failures. */
async function deliver(
  endpoint: string,
  body: Record<string, string>,
  maxAttempts: number = DEFAULT_ATTEMPTS
): Promise<SyncResult> {
  const url = `${BASE_URL}/${endpoint}`;
  const who = body.volunteer_mobile_number || "?";
  const startedAt = Date.now();
  let lastDetail = "no attempt made";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tag = attempt > 1 ? ` (attempt ${attempt}/${maxAttempts})` : "";
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
        // An HTTP-level rejection is their considered answer, not a glitch —
        // do not retry it, or a 422 becomes three identical 422s.
        const detail = looksHtml
          ? `HTTP ${res.status} — HTML page, not JSON (WAF block or unrouted URL)`
          : `HTTP ${res.status}: ${text.slice(0, 200)}`;
        console.error(
          `[community-sync] ${endpoint} FAILED for ${who} → ${detail}${tag}` +
            `\n  url: ${url}` +
            `\n  payload: ${JSON.stringify(body)}` +
            `\n  response: ${text.slice(0, 300)}`
        );
        return { ok: false, detail };
      }

      // Log successes too, with the FULL payload and elapsed ms.
      //   - the payload, because "which value did we actually send?" (is_present
      //     yes vs no, which service_name) is the question that comes up every
      //     time their side and ours disagree, and a partial log can't answer it
      //   - the timing, because it separates a delivery problem from an API one
      console.log(
        `[community-sync] ${endpoint} OK for ${who} in ${Date.now() - startedAt}ms${tag}` +
          `\n  sent: ${JSON.stringify(body)}` +
          `\n  got:  ${text.slice(0, 200)}`
      );
      return { ok: true, detail: text.slice(0, 200) };
    } catch (err) {
      // Network/timeout failure — the transient class worth retrying
      // (ECONNRESET, TLS handshake torn down, DNS blip, timeout).
      lastDetail =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      const backoff = RETRY_BACKOFF_MS[attempt - 1];
      if (attempt < maxAttempts && backoff !== undefined) {
        console.warn(
          `[community-sync] ${endpoint} network error for ${who} — retrying in ${backoff}ms: ${lastDetail}`
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.error(
        `[community-sync] ${endpoint} request error for ${who} after ${attempt} attempt(s): ${lastDetail}` +
          `\n  url: ${url}\n  payload: ${JSON.stringify(body)}`
      );
    }
  }
  return { ok: false, detail: lastDetail };
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

// Single source of truth for the assign-seva payload, so the fire-and-forget
// path and the awaitable batch path can never drift apart.
function assignSevaBody(
  eventId: string,
  serviceName: string,
  volunteerPhone: string,
  devoteePhone?: string
): Record<string, string> {
  return {
    service_name: serviceName,
    event_id: eventId,
    volunteer_mobile_number: volunteerPhone,
    devotee_mobile_number: devoteePhone || volunteerPhone,
  };
}

export function syncAssignSeva(
  eventId: string,
  serviceName: string,
  volunteerPhone: string,
  devoteePhone?: string
) {
  post("assign-seva", assignSevaBody(eventId, serviceName, volunteerPhone, devoteePhone));
}

/**
 * Awaitable assign-seva, for the daily re-sync job.
 *
 * The request handlers use the fire-and-forget `syncAssignSeva` because the
 * user should not wait on a third-party call. The cron job is the opposite:
 * nobody is waiting, and it needs the per-volunteer outcome to report how many
 * pushes actually landed.
 */
export async function syncAssignSevaNow(
  eventId: string,
  serviceName: string,
  volunteerPhone: string,
  devoteePhone?: string
): Promise<SyncResult> {
  return deliver(
    "assign-seva",
    assignSevaBody(eventId, serviceName, volunteerPhone, devoteePhone)
  );
}

// `date` is the event day the attendance applies to, as `yyyy-MM-dd`.
// Their API rejects the call without it ("The date field is required"), and
// it is meaningful here: VCC tracks attendance per day, so the same volunteer
// is marked present on several distinct dates across one festival.
// Required (not optional) on purpose — a missing date must be a compile error,
// not a 422 discovered in production.
function markAttendanceBody(
  eventId: string,
  volunteerPhone: string,
  isPresent: boolean,
  date: string
): Record<string, string> {
  return {
    event_id: eventId,
    volunteer_mobile_number: volunteerPhone,
    is_present: isPresent ? "yes" : "no",
    date,
  };
}

export function syncMarkAttendance(
  eventId: string,
  volunteerPhone: string,
  isPresent: boolean,
  date: string
) {
  post("mark-attendance", markAttendanceBody(eventId, volunteerPhone, isPresent, date));
}

/**
 * Awaitable mark-attendance, for callers that record the outcome.
 *
 * The check-in and admin routes use this so the result can be written onto the
 * registration — VCC marks the volunteer attended either way, but an admin can
 * then see whether the community app got the message.
 */
export async function syncMarkAttendanceNow(
  eventId: string,
  volunteerPhone: string,
  isPresent: boolean,
  date: string
): Promise<SyncResult> {
  return deliver(
    "mark-attendance",
    markAttendanceBody(eventId, volunteerPhone, isPresent, date)
  );
}
