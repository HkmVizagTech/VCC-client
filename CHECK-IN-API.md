# VCC Check-in API — Volunteer Attendance (2 calls)

**System:** Volunteer Care Cell (VCC) — Hare Krishna Movement Visakhapatnam
**Audience:** Mobile app developers integrating venue check-in / attendance.
**Base URLs:** Production `https://vcc-client.vercel.app` · Local `http://localhost:3000`

> These are the **only two calls** needed for attendance. Both are **public** (no login, no token) and both are **idempotent per day** — safe to retry.

---

## Overview

When a volunteer arrives at the venue, they scan the QR (or open the link) which points to the check-in page. The flow is **two steps**, matching these two calls:

1. **Look up** — given the phone number, fetch the volunteer's identity and their attendance state ("is this you?").
2. **Confirm** — after the volunteer confirms, record their attendance **for a specific day**.

Attendance is **per day** — a multi-day festival records one entry per day the volunteer attends.

---

## Call 1 — Look up the volunteer (identity check)

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/events/public/:eventId/check-in?phone=9876543210` |
| **Auth** | None (public) |

The `eventId` is the short uppercase event code (e.g. `SKJ26V`). The `phone` query parameter is the volunteer's 10-digit registered mobile number (non-digits are stripped, only the last 10 are kept).

**curl:**
```bash
curl "https://vcc-client.vercel.app/api/events/public/SKJ26V/check-in?phone=9876543210"
```

**Response (200):**
```json
{
  "volunteer": {
    "_id": "6a796695123edd9fb32a061a",
    "name": "Rama Das",
    "phone": "9876543210",
    "photoKey": "volunteers/1725182601234-ab12cd.jpg"
  },
  "event": {
    "_id": "6a7717364ae497f56781ce9b",
    "name": "Sri Krishna Janmashtami 2026",
    "venue": "Gadiraju convention centre",
    "eventStart": "2026-09-04T04:16:00.000Z",
    "eventEnd": "2026-09-08T04:16:00.000Z",
    "days": ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"]
  },
  "registration": {
    "_id": "6a796695123edd9fb32a061b",
    "status": "assigned",
    "alreadyCheckedIn": false,
    "checkedInDays": [],
    "noShowDays": [],
    "serviceId": { "_id": "...", "name": "Parking" }
  }
}
```

**How to use it in the app:**
- Show the volunteer's `name` and `photoKey` (photo served via `GET /api/upload/photo?key=<photoKey>`) so they can confirm it's them.
- `event.days` is the full list of attendance days (render one chip per day).
- A day present in `checkedInDays` → already checked in (mark as done / disabled).
- A day present in `noShowDays` → was marked no-show (show: *"you were marked as a no show — checking in will record you as attended"*).
- `registration.serviceId` is the seva they were assigned, if any.
- If **every** day in `event.days` is in `checkedInDays`, skip step 2 and show "Already checked in".

**Possible errors:**

| Status | Message | App should show |
|--------|---------|----------------|
| `400` | `Phone number must be exactly 10 digits` | Fix phone input |
| `404` | `Event not found` | Wrong QR / link |
| `404` | `You are not registered as a volunteer` | "Not registered" |
| `404` | `You are not registered for this event` | "Not registered for this event" |

---

## Call 2 — Confirm attendance for a day

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/events/public/:eventId/check-in` |
| **Auth** | None (public) |

Send the phone (and optionally the day) the volunteer selected in step 1. Any **registered** volunteer can check in — even without an assigned service.

**Request body (JSON):**
```json
{
  "phone": "9876543210",
  "date": "2026-09-04"
}
```

`date` is optional and must be a `yyyy-MM-dd` event day. When omitted it defaults to **today** if the event is running, otherwise the first event day.

**curl:**
```bash
curl -X POST https://vcc-client.vercel.app/api/events/public/SKJ26V/check-in \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"9876543210\",\"date\":\"2026-09-04\"}"
```

**Response (200 — checked in or already checked in for that day):**
```json
{
  "message": "Check-in successful",
  "alreadyCheckedIn": false,
  "date": "2026-09-04",
  "checkedInDays": ["2026-09-04"],
  "volunteer": {
    "_id": "6a796695123edd9fb32a061a",
    "name": "Rama Das",
    "phone": "9876543210",
    "photoKey": "volunteers/1725182601234-ab12cd.jpg"
  },
  "event": { "_id": "...", "name": "Sri Krishna Janmashtami 2026", "venue": "Gadiraju convention centre" },
  "registration": { "_id": "...", "status": "attended", "serviceId": null }
}
```

**Notes:**
- `alreadyCheckedIn: true` means the volunteer had **already checked in for that day** — the call is idempotent per day, safe to retry.
- `checkedInDays` is the volunteer's complete list of attended days so far.
- A day marked **`no_show`** is overridden to `attended` when the volunteer checks in — being at the venue scanning the QR is proof of presence.
- Checking in for the **first** day sets the registration's overall status to `attended` (shown as "Attended" in the admin panel and My Seva).

**Possible errors:**

| Status | Message | App should show |
|--------|---------|----------------|
| `400` | `Phone number must be exactly 10 digits` | Fix phone input |
| `400` | `Invalid check-in date` | Day is not part of the event |
| `404` | `Event not found` | Wrong QR / link |
| `404` | `You are not registered as a volunteer` | "Not registered" |
| `404` | `You are not registered for this event` | "Not registered for this event" |

---

## Status lifecycle (for context)

A registration moves `registered → assigned → attended` (or `no_show` / `cancelled`). With per-day attendance:

- Overall **`attended`** = the volunteer checked in on **at least one** day.
- The mobile app only ever **reads** statuses — all admin changes (assigning sevas, marking no-show, undoing mistakes) happen in the admin panel.
