# VCC API Reference — for the HKM Volunteer Mobile App

**System:** Volunteer Care Cell (VCC) — Hare Krishna Movement Visakhapatnam
**Audience:** Mobile app developers, testers, and anyone integrating with the VCC backend.
**Version:** 1.1 (merged single-app deployment)

> If you're reading this to learn what an API is, start at [Part 1 — The Basics](#part-1--the-basics). If you're a developer integrating the app, jump to [Part 2 — Mobile Endpoints](#part-2--mobile-endpoints-the-7-calls-your-app-needs).

---

## Part 1 — The Basics

### What is an API?

An API is a set of **addresses on a server** that your app can send requests to and get data back from. Think of it like a waiter in a restaurant:

- **You (your app)** make a *request* — "I want to see all events" or "I want to register this volunteer".
- **The API (waiter)** goes to the kitchen (database), does the work, and brings back a *response* (the result, usually in JSON format).

### Key words you'll see everywhere

| Word | Meaning |
|------|---------|
| **Base URL** | The address of the server. Every endpoint below starts with this. |
| **Endpoint** | A specific address + action. Example: `POST /api/events/public/SKJ26V/register` |
| **GET** | "Fetch / read something." No data sent in the body. |
| **POST** | "Create something new" (e.g. a registration, or an uploaded photo). |
| **PUT** | "Update something" (e.g. change a status). |
| **Request body** | The JSON data your app sends along with POST/PUT. |
| **Response** | The JSON the server sends back. |
| **JSON** | The data format — text structured as `"key": "value"` pairs. |
| **HTTP status code** | A number that tells you the result. `200` = ok, `201` = created, `400` = bad request, `404` = not found, `409` = already exists, `500` = server error. |
| **Event ID** | A short uppercase code for an event (e.g. `SKJ26V`), set by the admin. This is what goes in the URL, **not** the database `_id`. |
| **Phone** | The volunteer's identity. Always stored as exactly **10 digits** (see Part 2, Step 6). |

### Base URL

Everything below goes against one of these base URLs:

| Environment | Base URL |
|-------------|----------|
| **Production (live)** | `https://vcc-client.vercel.app` |
| **Local development** | `http://localhost:3000` |

Example: the events endpoint in production is
`https://vcc-client.vercel.app/api/events/public`

### What is curl?

**curl** is a small command-line tool (included in Windows 10/11, macOS, and Linux) that lets you send API requests from a terminal. The mobile team will use it to test the API while developing. You don't need to use curl to run the system — it's just a quick way to *test* an API call without building an app.

On Windows, open **Command Prompt (cmd)** or **PowerShell** and type the command. Example:

```
curl https://vcc-client.vercel.app/api/health
```

This "asks" the server if it's alive, and the server answers back with JSON.

### How authentication works (admin endpoints only)

Most **mobile** endpoints are public (no login needed). A few **admin** endpoints (like creating events or assigning work) need a JWT token:

- Your app logs in as a coordinator → gets a **token** back.
- Every admin request sends it in a header:
  `Authorization: Bearer <token>`

The mobile app itself never needs this — it only uses the public endpoints in Part 2.

---

## Part 2 — Mobile Endpoints (the 7 calls your app needs)

Your app has exactly 7 jobs. Here they are, one by one.

### 1. Check the server is alive

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/health` |

**curl:**
```
curl https://vcc-client.vercel.app/api/health
```

**Response (200):**
```json
{ "status": "ok", "timestamp": "2026-08-10T05:49:57.101Z", "mongodb": "connected" }
```

Use this in the app's "loading" screen or as a connectivity check.

---

### 2. Get the list of events (registration screen)

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/events/public` |

Returns events that are `registration_open`, `registration_closed`, or `ongoing` — the events a volunteer could register for or attend.

**curl:**
```
curl https://vcc-client.vercel.app/api/events/public
```

**Response (200):**
```json
{
  "events": [
    {
      "_id": "6a7717364ae497f56781ce9b",
      "eventId": "SKJ26V",
      "name": "Sri Krishna Janmashtami 2026",
      "description": "mega event",
      "venue": "Gadiraju convention centre",
      "registrationStart": "2026-08-01T05:30:00.000Z",
      "registrationEnd": "2026-08-21T04:16:00.000Z",
      "eventStart": "2026-09-04T04:16:00.000Z",
      "eventEnd": "2026-09-08T04:16:00.000Z",
      "status": "registration_open",
      "photoRequired": false,
      "coordinatorId": { "_id": "...", "name": "chaitanya", "email": "..." }
    }
  ]
}
```

**Notes for the app:**
- Show events where `status` is `registration_open` as "Register now".
- **`eventId`** (e.g. `SKJ26V`) is the human-readable code you use in the URLs for Step 3, 4 and 6.
- `photoRequired: true` means the registration form should require a photo (see Step 5).

---

### 3. Get event details (registration form)

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/events/public/:eventId` |

Returns the full event, including `availabilitySlots`, `photoRequired`, and `customFields` — everything the registration screen needs to render.

**curl:**
```
curl https://vcc-client.vercel.app/api/events/public/SKJ26V
```

**Response (200):** the full event document. The interesting extra fields are:

```json
{
  "event": {
    "_id": "6a7717364ae497f56781ce9b",
    "eventId": "SKJ26V",
    "name": "Sri Krishna Janmashtami 2026",
    "photoRequired": true,
    "availabilitySlots": ["Morning 8-11 AM", "Evening 5-8 PM"],
    "customFields": [
      {
        "id": "a1b2c3",
        "label": "Vehicle number",
        "type": "short_text",
        "required": false,
        "options": []
      },
      {
        "id": "d4e5f6",
        "label": "Preferred department",
        "type": "select",
        "required": true,
        "options": ["Parking", "Prasadam", "Security"]
      }
    ]
  }
}
```

**Custom field types:** `short_text`, `long_text`, `number`, `email`, `phone`, `select`, `radio`, `checkbox`, `date`, `devotee_select`.

**Response (404):** `{ "message": "Event not found" }` (wrong event code)

---

### 4. Get event time slots (availability picker)

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/events/public/:eventId/time-slots` |

A lightweight version of Step 3 that returns just the slots a volunteer can say they're free for.

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

Send the volunteer's chosen slots back in the registration call as `serviceAvailability` (Step 6): `[{ "date": "2026-09-04", "timeSlot": "Morning 8-11 AM" }]`.

---

### 5. Upload a volunteer photo (optional)

| Method | Endpoint |
|--------|----------|
| `POST` | `/api/upload/photo` |

Uploads a photo to object storage and returns a **`key`** that you store on the volunteer. Do this **before** registering, then pass `photoKey` in the registration body. Required only when the event has `photoRequired: true`.

Send a `multipart/form-data` request with the file in a field named **`photo`**. The photo must be a JPEG under 1 MB (compress/resize in the app first).

**curl:**
```
curl -X POST https://vcc-client.vercel.app/api/upload/photo ^
  -F "photo=@C:\photos\rama.jpg"
```

**Response (201):**
```json
{ "key": "volunteers/1725182601234-ab12cd.jpg" }
```

**Possible errors:**

| Status | Message | Meaning |
|--------|---------|---------|
| `400` | `No photo provided` | Missing `photo` form field |
| `400` | `Photo exceeds 1 MB limit after compression` | File too big |

**Serving the photo back:** `GET /api/upload/photo?key=volunteers/1725182601234-ab12cd.jpg` responds with a `302` redirect to a pre-signed URL valid for 1 hour. Images are cached for a year, so the same key keeps working.

---

### 6. Register a volunteer (the most important call)

| Method | Endpoint |
|--------|----------|
| `POST` | `/api/events/public/:eventId/register` |

Registers a volunteer for a specific event (the event code goes in the URL). It does three things automatically:

1. **Looks up the volunteer by phone number.** If they've volunteered before, their existing profile is reused — same person in the admin panel.
2. If they're new, **creates their profile**.
3. Creates the **registration record** linking them to the event.

> Because phone number is the volunteer's identity, a returning volunteer who registers from the mobile app OR the website is the *same person* in the admin panel.

**Request body (JSON):**
```json
{
  "name": "Rama Das",
  "phone": "9876543210",
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

**Required fields:** `name`, `phone`
**Optional fields:** everything else.

- `phone` — any Indian number. Non-digits are stripped and only the last **10 digits** are kept. Invalid → `400 "Phone number must be exactly 10 digits"`.
- `skills` accepts: `medical`, `photography`, `videography`, `driving`, `electrical`, `sound`, `it`, `graphic_design`, `cooking`, `crowd_management`, `other`.
- `customAnswers` — the event's custom fields. Send as an array of `{ fieldId, value }` (or as an object map `{ "d4e5f6": "Parking" }`). If an event defines a custom field marked required/important, the server rejects the registration without it. Checkboxes and `devotee_select` accept arrays of values.
- `serviceAvailability` — array of `{ date, timeSlot }` pairs matching the event's `availabilitySlots`.

**curl (Windows cmd):**
```
curl -X POST https://vcc-client.vercel.app/api/events/public/SKJ26V/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Rama Das\",\"phone\":\"9876543210\"}"
```

> Tip: on Windows, escaping quotes is painful. Put the JSON in a file (`body.json`) and use:
> ```
> curl -X POST https://vcc-client.vercel.app/api/events/public/SKJ26V/register -H "Content-Type: application/json" -d "@body.json"
> ```

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
    "photoKey": "volunteers/1725182601234-ab12cd.jpg"
  }
}
```

**Possible errors:**

| Status | Message | What it means / app should show |
|--------|---------|-------------------------------|
| `400` | `Registration is not open for this event` | Event not accepting registrations yet |
| `400` | `Registration deadline has passed` | Too late |
| `404` | `Event not found` | Wrong event code in the URL |
| `409` | `Already registered for this event` | Volunteer already signed up — show "You're already registered" |

**Alternative endpoint:** `POST /api/registrations` does the same thing, but takes the Mongo `_id` in the body instead of the code in the URL:

```json
{ "eventId": "6a7717364ae497f56781ce9b", "name": "Rama Das", "phone": "9876543210" }
```

Prefer the `.../register` URL form — it uses the stable, human-readable event code.

---

### 7. Venue check-in (QR code at the event)

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/events/public/:eventId/check-in?phone=9876543210` |
| `POST` | `/api/events/public/:eventId/check-in` |

A QR is printed at the venue that opens `/check-in/:eventId`. The flow is **two steps**: the volunteer types their registered phone number, the app shows "Is this you?" (name + photo + assigned seva) and asks **which day** they are checking in for (events can be multi-day), and only after they confirm is attendance recorded. It is the phone-number identity, so use it *after* registration — **any registered volunteer can check in**, even without an assigned service. The admin sees who's present and assigns seva on the spot.

Attendance is recorded **per day** — a volunteer who comes on day 1 and day 3 of a 5-day festival gets two separate check-in records.

**Step 1 — Identity lookup (GET):**
```
curl "https://vcc-client.vercel.app/api/events/public/SKJ26V/check-in?phone=9876543210"
```

**Response (200):**
```json
{
  "volunteer": { "_id": "...", "name": "Rama Das", "phone": "9876543210", "photoKey": "volunteers/...jpg" },
  "event": {
    "_id": "...",
    "name": "Sri Krishna Janmashtami 2026",
    "venue": "Gadiraju convention centre",
    "days": ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"]
  },
  "registration": {
    "_id": "...",
    "status": "assigned",
    "alreadyCheckedIn": false,
    "checkedInDays": [],
    "noShowDays": [],
    "serviceId": { "_id": "...", "name": "Parking" }
  }
}
```

Render one day chip per entry in `event.days` (default to today if the event is running). Mark chips in `checkedInDays` as done, chips in `noShowDays` as "was marked no show". When the volunteer confirms, send the chosen `date` with the POST.

**Step 2 — Confirm attendance (POST):**

**Request body (JSON):**
```json
{ "phone": "9876543210", "date": "2026-09-04" }
```
`date` is optional — when omitted it defaults to today if the event is running, otherwise the first event day. Responses include `date` and `checkedInDays`.

**curl:**
```
curl -X POST https://vcc-client.vercel.app/api/events/public/SKJ26V/check-in ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"9876543210\",\"date\":\"2026-09-04\"}"
```

**Response (200 — checked in or already checked in):**
```json
{
  "message": "Check-in successful",
  "alreadyCheckedIn": false,
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

- `alreadyCheckedIn: true` means the volunteer had already checked in **for that day** (the call is idempotent per day — safe to retry).
- `registration.serviceId` is the seva they were assigned, if any.
- A volunteer marked **`no_show` for that day who scans the QR is allowed to check in** — being at the venue is proof of presence, so that day is recorded as `attended`.
- Per-day check-ins / no-shows can be undone by an admin from the attendance panel (`/admin/attendance`).

**Possible errors:**

| Status | Message | App should show |
|--------|---------|----------------|
| `400` | `Phone number must be exactly 10 digits` | Fix phone input |
| `400` | `Invalid check-in date` | Wrong day / date not part of the event |
| `404` | `Event not found` | Wrong QR / link |
| `404` | `You are not registered as a volunteer` | "Not registered" |
| `404` | `You are not registered for this event` | "Not registered for this event" |

---

### 8. Show a volunteer's seva ("My Seva" screen)

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/volunteers/by-phone/:phone` |

Given the volunteer's **phone number**, returns their profile plus **all their registrations** (with event details, assigned service, and coordinator contact). This is the screen that shows "what work I've been assigned". Use it both for the pre-registration check (does this phone already exist?) and for the "My Seva" lookup.

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

**Key points for the app:**
- `status` is the volunteer's progress for that event: `registered` → `assigned` → `attended`.
- When the admin assigns work, `serviceId` becomes populated (it's `null`/absent until then). Show the service name to the volunteer.
- `serviceId.coordinatorId` is the person to contact for that seva.
- `photoKey` is the volunteer's photo, if they uploaded one. Display it with `GET /api/upload/photo?key=<photoKey>` (302 redirect to the image).

**Response (404):** `{ "message": "Volunteer not found" }`

---

### Note — Status changes are admin-only

Volunteers can never change their own status — the app only *reads* seva data (profile + assignments + status). All status transitions (`registered` → `assigned` → `attended` / `no_show`, or `cancelled`) happen in the admin panel.

---

## Part 3 — Status Lifecycle (what the statuses mean)

A registration moves forward through these statuses. This is the "journey" of a volunteer:

```
registered ──▶ assigned ──▶ attended
      │            │            │
      │            └──(admin assigns a service)──▶ assigned
      │            │
      │            └──(volunteer scans QR / admin marks)──▶ attended
      │
      └──(admin cancels)──▶ cancelled

Undo (admin): attended ⇄ no_show, attended/no_show ─▶ assigned (pending)
```

| Status | Who sets it | Meaning |
|--------|-------------|---------|
| `registered` | App / website (automatic) | Volunteer signed up for the event |
| `assigned` | Admin | Admin put them on a specific service (Parking, etc.) |
| `attended` | Coordinator / venue QR | Volunteer showed up on the day |
| `no_show` | Coordinator | They didn't show up (can be overridden if they arrive later) |
| `cancelled` | Admin | They backed out |

The mobile app only ever *reads* these statuses. All status changes are admin-side via `PUT /api/registrations/:id/status`.

---

## Part 4 — Full endpoint list (for reference)

### Public (used by mobile app + website — no auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Server + DB health check |
| `GET` | `/api/events/public` | List open/upcoming events |
| `GET` | `/api/events/public/:eventId` | Single event by event code |
| `GET` | `/api/events/public/:eventId/time-slots` | Event's availability slots |
| `POST` | `/api/events/public/:eventId/register` | Register a volunteer for an event |
| `GET` | `/api/events/public/:eventId/check-in?phone=` | Identity lookup before check-in ("is this you?") |
| `POST` | `/api/events/public/:eventId/check-in` | Confirm a volunteer's attendance for a day (`{ phone, date }`) |
| `POST` | `/api/registrations` | Register (event Mongo `_id` in body) |
| `GET` | `/api/volunteers/by-phone/:phone` | Volunteer profile + seva assignments |
| `GET` | `/api/seva/:phone` | Same as by-phone (used by `/my-seva/:phone` page) |
| `POST` | `/api/upload/photo` | Upload a volunteer photo → `{ key }` |
| `GET` | `/api/upload/photo?key=` | 302 redirect to the photo URL (1 h signed) |
| `GET` | `/api/devotees` | List devotees (for `devotee_select` fields) |

### Admin (JWT required — used by the web admin panel)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/users/login` | Coordinator login → JWT token |
| `POST` | `/api/users/logout` | Logout |
| `GET` | `/api/users/profile` | Current logged-in user |
| `GET/POST` | `/api/users` | List / create coordinators (Super Admin) |
| `PUT/DELETE` | `/api/users/:id` | Update / delete coordinator (Super Admin) |
| `PUT` | `/api/users/:id/status` | Activate / deactivate coordinator |
| `GET/POST` | `/api/volunteers` | List (paginated/searchable) / create volunteers |
| `GET` | `/api/volunteers/search?q=` | Quick search by name/phone |
| `GET/PUT` | `/api/volunteers/:id` | Get / update volunteer |
| `GET/POST` | `/api/events` | List / create events |
| `GET/PUT` | `/api/events/:id` | Get / update event (changing `eventId` requires Super Admin + admin password) |
| `PUT` | `/api/events/:id/status` | Advance event status |
| `DELETE` | `/api/events/:id` | Delete event (Super Admin, requires admin password in body) |
| `GET` | `/api/services/event/:eventId` | Services for an event |
| `POST` | `/api/services` | Create a service |
| `PUT/DELETE` | `/api/services/:id` | Update / delete service |
| `PUT` | `/api/services/:id/coordinator` | Assign coordinator to service |
| `GET` | `/api/registrations/event/:eventId` | Registrations for an event |
| `GET` | `/api/registrations/stats` | Registration stats |
| `GET` | `/api/registrations/volunteer/:volunteerId` | A volunteer's registrations |
| `PUT` | `/api/registrations/:id/status` | Change a registration's status |
| `PUT` | `/api/registrations/:id/attendance` | Mark / unmark per-day attendance `{ date, status: attended|no_show|unmark }` |
| `PUT` | `/api/registrations/:id/service` | Assign one volunteer to a service |
| `PUT` | `/api/registrations/bulk-assign` | Assign many volunteers at once |
| `POST` | `/api/devotees` | Create a devotee |
| `PUT/DELETE` | `/api/devotees/:id` | Update / delete devotee |
| `GET` | `/api/stats/dashboard` | Dashboard numbers & charts |
| `GET` | `/api/stats/event/:eventId` | Per-event stats |
| `GET` | `/api/stats/report` | Full data for CSV export |

---

## Part 5 — Common error handling (for the app team)

All errors come back in the same shape, with an HTTP status code:

```json
{ "message": "Human-readable explanation" }
```

| Status | When | App behaviour |
|--------|------|---------------|
| `400` | Bad input, wrong state | Show the `message` to the user |
| `401` | Missing / invalid token (admin only) | Send user to login |
| `403` | Logged in but not enough permission | Show "not allowed" |
| `404` | Not found | Show friendly "not found" message |
| `409` | Already exists (e.g. duplicate registration) | Show "you're already registered" |
| `500` | Server / database error | Generic error screen + retry |

---

## Part 6 — How volunteers register

Volunteers register through the **Hare Krishna Visakhapatnam mobile app** (and the harekrishnavizag.org website). Both post to the same registration endpoint (`POST /api/events/public/:eventId/register`), so a volunteer who registers from the app is the *same person* in the admin panel as one who registered on the website — the phone number is their identity.

- **Events list (public site):** `https://vcc-client.vercel.app/events`
- **"My Seva" (see assigned work by phone):** `https://vcc-client.vercel.app/my-seva`

---

## Part 7 — Known limitations / pending items

| Item | Status |
|------|--------|
| Rate limiting on registration | Registration endpoint not yet rate-limited. |
| Admin JWT for mobile | Not needed — mobile uses only public endpoints. |
| Photo serving | Pre-signed URLs expire after 1 hour, but images are cached for a year (same key keeps working). |

---

*Generated for HKM Visakhapatnam. Questions: reach the VCC admin team.*
