# Changelog

## 2026-08-12

### Removed — `confirmed` status

The intermediate `confirmed` status is gone. Registrations now go `registered` → `assigned` → `attended` (or `no_show`/`cancelled`).

- **Model** (`lib/models/registration.model.ts`): dropped `confirmed` from the status enum.
- **Status API** (`app/api/registrations/[id]/status/route.ts`): transition map now starts from `assigned` → `attended` / `no_show` / `cancelled`. `registered` cannot transition directly anymore — assign a service first.
- **Deleted endpoints:** `PUT /api/seva/:registrationId/confirm` and `PUT /api/seva/:registrationId/decline`. Volunteers can no longer change their own status.
- **My Seva pages** (`app/my-seva`, `app/my-seva/[token]`): removed Confirm / Decline buttons — now read-only.
- **Admin UI:** removed `confirmed` from event registrations, assignments, attendance, dashboard (funnel + stat card), reports, and the volunteer details dialog. Attendance no longer has a confirm intermediate step.
- **Stats API** (`app/api/stats/dashboard/route.ts`): no longer returns a `confirmed` count.
- **Docs:** updated `API-DOCS.md`, `API-DOCS.html`, `README.md` (root + client) to the new lifecycle.
