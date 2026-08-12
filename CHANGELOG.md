# Changelog

## 2026-08-12

### Added — per-day attendance

Attendance is now tracked **per day** for multi-day events (e.g. a 5-day festival). A volunteer who attends on two different days gets two check-in records.

- **Model** (`lib/models/registration.model.ts`): new `dayAttendance` array `[{ date, status: attended|no_show, checkedInAt, source: qr|admin }]` — one entry per event day.
- **Check-in API** (`app/api/events/public/[eventId]/check-in/route.ts`): `GET` returns the event's `days`, the volunteer's `checkedInDays` and `noShowDays`; `POST` accepts an optional `date` (defaults to today / first event day), records the day's check-in and keeps the overall status truthful (`attended` once any day is attended). Per-day no-show is overridden when the volunteer scans the QR.
- **New endpoint** `PUT /api/registrations/:id/attendance` (`{ date, status: attended|no_show|unmark }`) for admin per-day marking, with undo. Removing the last attended day reverts the overall status to the pending pool.
- **Check-in page** (`app/check-in/[eventId]/page.tsx`): day selector chips (checked-in / no-show states, "Today" marker) before confirming.
- **Admin attendance page** (`app/admin/attendance/page.tsx`): now a per-day view — day selector (defaults to today), per-day stats (Checked In / No Show / Pending), per-day Check In / No Show / Undo actions, overall status shown for context.
- **Util** (`lib/utils/event-days.ts`): shared event-day computation and date-range validation.
- **Docs**: `API-DOCS.md` updated for the per-day check-in flow.

### Completed — venue check-in & attendance

The QR check-in flow (venue QR → phone entry → confirm attendance) is complete, with a two-step identity confirmation so volunteers verify "this is me" before being recorded as attended.

- **Check-in API** (`app/api/events/public/[eventId]/check-in/route.ts`): added `GET ?phone=` identity lookup (returns volunteer + photo + assigned seva + already-checked-in/no-show flags); `POST` now lets **any registered volunteer** check in and **overrides a `no_show` mark** — scanning the venue QR is proof of presence.
- **Check-in page** (`app/check-in/[eventId]/page.tsx`): new flow — enter phone → confirm identity (name, photo, seva, no-show notice) → confirm attendance. Keeps the idempotent "already checked in" success screen.
- **Status transitions** (`app/api/registrations/[id]/status/route.ts`): `registered` can now go straight to `attended`/`no_show`; `attended` and `no_show` are no longer terminal — admins can undo mistakes (back to `assigned`). Minimum role lowered to `service_coordinator` so venue staff can mark attendance.
- **New endpoint** `GET /api/stats/events`: lightweight event list (non-draft/archived, includes `eventId` code) for the attendance screen, accessible to all admin roles.
- **Admin attendance page** (`app/admin/attendance/page.tsx`): shows **all registered volunteers** (not just assigned), lets you **assign a seva on the spot**, offers **undo** for mistaken check-ins/no-shows, and has a **Check-in QR** button for the selected event.
- **Docs**: `API-DOCS.md` updated for the two-step check-in, no-show override, and undo rules.


The intermediate `confirmed` status is gone. Registrations now go `registered` → `assigned` → `attended` (or `no_show`/`cancelled`).

- **Model** (`lib/models/registration.model.ts`): dropped `confirmed` from the status enum.
- **Status API** (`app/api/registrations/[id]/status/route.ts`): transition map now starts from `assigned` → `attended` / `no_show` / `cancelled`. `registered` cannot transition directly anymore — assign a service first.
- **Deleted endpoints:** `PUT /api/seva/:registrationId/confirm` and `PUT /api/seva/:registrationId/decline`. Volunteers can no longer change their own status.
- **My Seva pages** (`app/my-seva`, `app/my-seva/[token]`): removed Confirm / Decline buttons — now read-only.
- **Admin UI:** removed `confirmed` from event registrations, assignments, attendance, dashboard (funnel + stat card), reports, and the volunteer details dialog. Attendance no longer has a confirm intermediate step.
- **Stats API** (`app/api/stats/dashboard/route.ts`): no longer returns a `confirmed` count.
- **Docs:** updated `API-DOCS.md`, `API-DOCS.html`, `README.md` (root + client) to the new lifecycle.
