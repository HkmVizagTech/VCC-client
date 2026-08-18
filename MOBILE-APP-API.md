# VCC Mobile API — User Module, Register & My Seva

**System:** Volunteer Care Cell (VCC) — Hare Krishna Movement Visakhapatnam
**Audience:** Mobile app developers and the harekrishnavizag.org website team.
**Base URLs:** Production `https://vcc-client.vercel.app` · Local `http://localhost:3000`

> All endpoints below are **public** (no login, no token) and CORS-enabled for `https://harekrishnavizag.org` and `https://www.harekrishnavizag.org`.

## User Module

The **user module** is the shared identity contract between the mobile app and VCC. A user is identified by these three fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Full name |
| `phone_number` | string | Yes | 10-digit Indian mobile number (the unique identity) |
| `date_of_birth` | string (ISO date) | No | Format: `YYYY-MM-DD` (e.g. `"1998-03-15"`) |

> The phone number is the volunteer's **identity**. A volunteer who registers from the mobile app is the *same person* in the admin panel as one who registered on the website — the phone number matches them up.

The three core calls:

1. **Sync User** — create or look up a user when they open the mobile app.
2. **Register** — a volunteer signs up for an event.
3. **My Seva** — a volunteer looks up their profile and assigned seva by phone number.

---

## Call 1 — Sync User (create or look up)

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/volunteers/sync` |
| **Auth** | None (public) |

Call this when the user opens the mobile app or signs up. It creates the user if new, or returns the existing profile if the phone is already known. Safe to call every time — it's an upsert.

**Request body (JSON):**
```json
{
  "name": "Rama Das",
  "phone_number": "9876543210",
  "date_of_birth": "1998-03-15"
}
```

> Also accepts `phone` instead of `phone_number`, and `dateOfBirth` instead of `date_of_birth`.

**Required fields:** `name`, `phone_number` — `date_of_birth` is optional but recommended.

| Field | Rules |
|-------|-------|
| `phone_number` | Any Indian number. Non-digits are stripped and only the **last 10 digits** are kept. Invalid → `400 "Phone number must be exactly 10 digits"`. |
| `date_of_birth` | ISO date string `YYYY-MM-DD`. Stored once — if the user already has a DOB on file, it won't be overwritten. |

**Response (201 — new user created):**
```json
{
  "message": "User created",
  "volunteer": {
    "_id": "6a796695123edd9fb32a061a",
    "name": "Rama Das",
    "phone": "9876543210",
    "dateOfBirth": "1998-03-15T00:00:00.000Z",
    "photoKey": null
  }
}
```

**Response (200 — existing user found):**
```json
{
  "message": "User found",
  "volunteer": {
    "_id": "6a796695123edd9fb32a061a",
    "name": "Rama Das",
    "phone": "9876543210",
    "dateOfBirth": "1998-03-15T00:00:00.000Z",
    "photoKey": "volunteers/1725182601234-ab12cd.jpg"
  }
}
```

**How to use it in the app:**
- Call this on app launch / signup to get or create the user's VCC profile.
- Store the returned `_id` locally — it's the volunteer's permanent ID.
- The `name` is updated if it differs from what's on file (e.g. user changed their name in the mobile app).

**Possible errors:**

| Status | Message | App should show |
|--------|---------|----------------|
| `400` | `Name is required` | Fix the name field |
| `400` | `Phone number must be exactly 10 digits` | Fix phone input |

---

## Call 2 — Register a volunteer for an event

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/api/events/public/:eventId/register` |
| **Auth** | None (public) |

`eventId` is the short uppercase event code (e.g. `SKJ26V`), shown on the events list. The call does three things automatically:

1. Looks up the volunteer **by phone**. If they've volunteered before, their existing profile is reused.
2. If they're new, **creates their profile**.
3. Creates the **registration record** linking them to the event.

**Request body (JSON):**
```json
{
  "name": "Rama Das",
  "phone": "9876543210",
  "date_of_birth": "1998-03-15",
  "age": 28,
  "gender": "male",
  "locality": "Dwaraka Nagar",
  "occupation": "Software Engineer",
  "occupationType": "working",
  "company": "ACME Ltd",
  "skills": ["it", "photography"],
  "photoKey": "volunteers/1725182601234-ab12cd.jpg",
  "serviceAvailability": [{ "date": "2026-09-04", "timeSlot": "Morning 8-11 AM" }],
  "customAnswers": [{ "fieldId": "d4e5f6", "value": "Parking" }],
  "notes": ""
}
```

**Required fields:** `name`, `phone` — everything else is optional.

| Field | Rules |
|-------|-------|
| `phone` | Any Indian number. Non-digits are stripped and only the **last 10 digits** are kept. Invalid → `400 "Phone number must be exactly 10 digits"`. |
| `date_of_birth` | ISO date `YYYY-MM-DD`. Saved only for new volunteers (use sync to update existing). Also accepts `dateOfBirth`. |
| `gender` | `male` \| `female` \| `other` |
| `occupationType` | `student` \| `working` (use `institution` for students, `company` for working) |
| `skills` | `medical`, `photography`, `videography`, `driving`, `electrical`, `sound`, `it`, `graphic_design`, `cooking`, `crowd_management`, `other` |
| `photoKey` | Returned by `POST /api/upload/photo` (upload first, then pass the key). Required only when the event has `photoRequired: true`. |
| `serviceAvailability` | Array of `{ date, timeSlot }` matching the event's availability slots (from `GET /api/events/public/:eventId/time-slots`). |
| `customAnswers` | Array of `{ fieldId, value }` (an object map like `{ "d4e5f6": "Parking" }` also works). Required/important custom fields are enforced server-side. Checkbox and `devotee_select` accept arrays of values. |

**curl (Windows cmd):**
```
curl -X POST https://vcc-client.vercel.app/api/events/public/SKJ26V/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Rama Das\",\"phone\":\"9876543210\"}"
```

> Tip: put the JSON in a file (`body.json`) and use `-d "@body.json"` to avoid quote-escaping pain on Windows.

**Response (201 — created):**
```json
{
  "message": "Registration successful",
  "registration": {
    "_id": "6a796695123edd9fb32a061b",
    "eventId": "6a7717364ae497f56781ce9b",
    "volunteerId": "6a796695123edd9fb32a061a",
    "status": "registered",
    "serviceAvailability": [],
    "customAnswers": []
  },
  "volunteer": {
    "_id": "6a796695123edd9fb32a061a",
    "name": "Rama Das",
    "phone": "9876543210",
    "dateOfBirth": "1998-03-15T00:00:00.000Z",
    "photoKey": "volunteers/1725182601234-ab12cd.jpg"
  }
}
```

**Possible errors:**

| Status | Message | App should show |
|--------|---------|----------------|
| `400` | `Name is required` | Fix the name field |
| `400` | `Phone number must be exactly 10 digits` | Fix phone input |
| `400` | `Registration is not open for this event` | "Registrations closed for this event" |
| `400` | `Registration deadline has passed` | "Registration is over" |
| `400` | `"<label>" is required` | Fill in the highlighted custom field |
| `400` | `"<label>" must be a number` / `has an invalid option` / `must be a valid date` | Fix the highlighted field |
| `404` | `Event not found` | Wrong event code / event removed |
| `409` | `Already registered for this event` | "You're already registered" (safe to show this as a success state) |

**Alternative endpoint:** `POST /api/registrations` does the same thing but takes the Mongo `_id` in the body instead of the event code in the URL. Prefer the `.../register` URL form — it uses the stable, human-readable event code.

---

## Call 3 — My Seva (profile + assignments by phone)

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/volunteers/by-phone/:phone` |
| **Auth** | None (public) |

Given the volunteer's registered phone number, returns their profile plus **all their registrations** with event details, assigned service, and the coordinator to contact. Use it for the "My Seva" screen and for the pre-registration check ("does this phone already exist?").

**curl:**
```
curl https://vcc-client.vercel.app/api/volunteers/by-phone/9876543210
```

**Response (200):**
```json
{
  "volunteer": {
    "_id": "6a796695123edd9fb32a061a",
    "name": "Rama Das",
    "phone": "9876543210",
    "dateOfBirth": "1998-03-15T00:00:00.000Z",
    "photoKey": "volunteers/1725182601234-ab12cd.jpg"
  },
  "registrations": [
    {
      "_id": "6a796695123edd9fb32a061b",
      "status": "assigned",
      "eventId": {
        "_id": "6a7717364ae497f56781ce9b",
        "name": "Sri Krishna Janmashtami 2026",
        "eventId": "SKJ26V",
        "status": "registration_open",
        "venue": "Gadiraju convention centre",
        "eventStart": "2026-09-04T04:16:00.000Z",
        "eventEnd": "2026-09-08T04:16:00.000Z"
      },
      "serviceId": {
        "_id": "...",
        "name": "Parking",
        "description": "...",
        "coordinatorId": { "_id": "...", "name": "chaitanya", "phone": "..." }
      }
    }
  ]
}
```

**How to use it in the app:**
- `status` is the volunteer's progress for that event: `registered` → `assigned` → `attended` (also `no_show` / `cancelled`).
- When the admin assigns work, `serviceId` becomes populated (it's `null`/absent until then). Show the service name to the volunteer.
- `serviceId.coordinatorId` is the person to contact for that seva (tap-to-call / WhatsApp).
- `photoKey` is the volunteer's photo, if uploaded. Display it with `GET /api/upload/photo?key=<photoKey>` (302 redirect to the image).

**Possible errors:**

| Status | Message | App should show |
|--------|---------|----------------|
| `404` | `Volunteer not found` | "No account found with this number" + offer to register |

**Same data, shareable link:** the `/my-seva/<phone>` web page uses the identical endpoint, so a volunteer can also view their seva in a browser.

---

## Call 4 (supporting) — Fetch event time slots (availability picker)

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/api/events/public/:eventId/time-slots` |
| **Auth** | None (public) |

Returns the **time slots the admin configured when creating the event** (the "Availability Time Slots" in the event setup). The app uses these to render the volunteer's availability picker in the registration form, then sends the chosen slots back in the registration call as `serviceAvailability`.

**curl:**
```
curl https://vcc-client.vercel.app/api/events/public/SKJ26V/time-slots
```

**Response (200):**
```json
{
  "eventId": "SKJ26V",
  "name": "Sri Krishna Janmashtami 2026",
  "eventStart": "2026-09-04T04:16:00.000Z",
  "eventEnd": "2026-09-08T04:16:00.000Z",
  "timeSlots": ["Morning 8-11 AM", "Evening 5-8 PM"]
}
```

**How to use it in the app:**
- Render one toggle per entry in `timeSlots` for **each day** of the event (days come from `eventStart`…`eventEnd`).
- Send the volunteer's choices back in registration as `serviceAvailability`: `[{ "date": "2026-09-04", "timeSlot": "Morning 8-11 AM" }]`.
- Note: the full event detail endpoint (`GET /api/events/public/:eventId`) also includes `availabilitySlots` — the same list — plus `customFields` and `photoRequired`, so the registration form can load everything in one call if preferred.
- `timeSlots` may be empty (`[]`) when the event has no slots configured — the app can then skip the availability step.

**Possible errors:**

| Status | Message | App should show |
|--------|---------|----------------|
| `404` | `Event not found` | Wrong event code / event removed |

---

## Note — statuses are read-only for volunteers

Volunteers can never change their own status. The mobile app only **reads** this data — all status changes (assigning a service, marking attendance, canceling) happen in the admin panel.

## Related calls (same public API family)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/volunteers/sync` | Create or look up user (the user module entry point) |
| `GET /api/events/public` | List events a volunteer can register for |
| `GET /api/events/public/:eventId` | Event details + custom fields + slots for the registration form |
| `GET /api/events/public/:eventId/time-slots` | The availability slots to send back as `serviceAvailability` |
| `POST /api/upload/photo` | Upload the volunteer photo → returns `photoKey` |
