# VCC API Reference — for the HKM Volunteer Mobile App

**System:** Volunteer Care Cell (VCC) — Hare Krishna Movement Visakhapatnam
**Audience:** Mobile app developers, testers, and anyone integrating with the VCC backend.
**Version:** 1.0 (merged single-app deployment)

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
| **Endpoint** | A specific address + action. Example: `POST /api/registrations` |
| **GET** | "Fetch / read something." No data sent in the body. |
| **POST** | "Create something new" (e.g. a registration). |
| **PUT** | "Update something" (e.g. change a status). |
| **Request body** | The JSON data your app sends along with POST/PUT. |
| **Response** | The JSON the server sends back. |
| **JSON** | The data format — text structured as `"key": "value"` pairs. |
| **HTTP status code** | A number that tells you the result. `200` = ok, `201` = created, `400` = bad request, `404` = not found, `409` = already exists, `500` = server error. |
| **Token** | A secret string of letters/numbers that identifies a volunteer. Like a password. |
| **OTP** | One-Time Password — the 6-digit code used to log a volunteer in by phone. |

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

Returns all events where volunteers can register or that are upcoming/ongoing.

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
      "name": "Sri Krishna Janmashtami 2026",
      "slug": "sri-krishna-janmashtami-2026",
      "description": "mega event",
      "venue": "Gadiraju convention centre",
      "registrationStart": "2026-08-01T05:30:00.000Z",
      "registrationEnd": "2026-08-21T04:16:00.000Z",
      "eventStart": "2026-09-04T04:16:00.000Z",
      "eventEnd": "2026-09-08T04:16:00.000Z",
      "status": "registration_open",
      "coordinatorId": { "_id": "...", "name": "chaitanya", "email": "..." }
    }
  ]
}
```

**Notes for the app:**
- Show events where `status` is `registration_open` as "Register now".
- The `_id` of an event is what you send in the registration call (Step 3).
- The `slug` is the URL-friendly name (used for the web link).

---

### 3. Register a volunteer (mobile registration)

| Method | Endpoint |
|--------|----------|
| `POST` | `/api/registrations` |

This is the **most important endpoint**. It does three things automatically:

1. Looks up the volunteer **by phone number**. If they've volunteered before, their existing profile is reused (same HKV number, same seva token).
2. If they're new, it creates their profile with a unique **HKV-XXXXX number** and a **seva token**.
3. Creates the registration record linking them to the event.

> Because phone number is the volunteer's identity, a returning volunteer registered from the mobile app OR the website is the *same person* in the admin panel.

**Request body (JSON):**
```json
{
  "eventId": "6a7717364ae497f56781ce9b",
  "name": "Rama Das",
  "phone": "9876543210",
  "whatsappNumber": "9876543210",
  "age": 28,
  "gender": "male",
  "locality": "Dwaraka Nagar",
  "occupation": "Software Engineer",
  "skills": ["it", "photography"]
}
```

**Required fields:** `eventId`, `name`, `phone`
**Optional fields:** everything else. `skills` accepts: `medical`, `photography`, `videography`, `driving`, `electrical`, `sound`, `it`, `graphic_design`, `cooking`, `crowd_management`, `other`.

**curl (Windows cmd):**
```
curl -X POST https://vcc-client.vercel.app/api/registrations ^
  -H "Content-Type: application/json" ^
  -d "{\"eventId\":\"6a7717364ae497f56781ce9b\",\"name\":\"Rama Das\",\"phone\":\"9876543210\"}"
```

> Tip: on Windows, escaping quotes is painful. Put the JSON in a file (`body.json`) and use:
> ```
> curl -X POST https://vcc-client.vercel.app/api/registrations -H "Content-Type: application/json" -d "@body.json"
> ```

**Response (201 — created):**
```json
{
  "message": "Registration successful",
  "registration": {
    "eventId": "6a7717364ae497f56781ce9b",
    "volunteerId": "6a796695123edd9fb32a061a",
    "status": "registered",
    "_id": "6a796695123edd9fb32a061b"
  },
  "volunteer": {
    "_id": "6a796695123edd9fb32a061a",
    "name": "Rama Das",
    "volunteerNumber": "HKV-00007",
    "sevaToken": "79a741cc0505c1bc86bf478ce42788df6b64302c31fbc089523f503637f28653"
  }
}
```

**Key points for the app:**
- Save the `sevaToken` returned — the app can store it and use it later to show "My Seva" without OTP.
- The `volunteerNumber` (`HKV-00007`) is their permanent ID.

**Possible errors:**

| Status | Message | What it means / app should show |
|--------|---------|-------------------------------|
| `400` | `Registration is not open for this event` | Event not accepting registrations yet |
| `400` | `Registration deadline has passed` | Too late |
| `404` | `Event not found` | Wrong `eventId` |
| `409` | `Already registered for this event` | Volunteer already signed up — show "You're already registered" |

---

### 4. Look up a volunteer by phone (optional pre-check)

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/volunteers/by-phone/:phone` |

Lets the app check whether a phone number already belongs to a registered volunteer before filling the whole form.

**curl:**
```
curl https://vcc-client.vercel.app/api/volunteers/by-phone/9876543210
```

**Response (200):**
```json
{ "volunteer": { "_id": "...", "name": "Rama Das", "volunteerNumber": "HKV-00007", ... } }
```

**Response (404):**
```json
{ "message": "Volunteer not found" }
```

---

### 5. Show a volunteer's assigned work ("My Seva" screen)

| Method | Endpoint |
|--------|----------|
| `GET` | `/api/seva/:token` |

Given the volunteer's **seva token**, returns their profile plus **all their registrations** (with event details, assigned service, and coordinator contact). This is the screen that shows "what work I've been assigned".

**curl:**
```
curl https://vcc-client.vercel.app/api/seva/79a741cc0505c1bc86bf478ce42788df6b64302c31fbc089523f503637f28653
```

**Response (200):**
```json
{
  "volunteer": {
    "name": "Rama Das",
    "volunteerNumber": "HKV-00007",
    "phone": "9876543210"
  },
  "registrations": [
    {
      "_id": "6a796695123edd9fb32a061b",
      "status": "registered",
      "eventId": {
        "_id": "6a7717364ae497f56781ce9b",
        "name": "Sri Krishna Janmashtami 2026",
        "slug": "sri-krishna-janmashtami-2026",
        "venue": "Gadiraju convention centre",
        "status": "registration_open"
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

**Response (404):** `{ "message": "Invalid seva token" }`

---

### 6. Send a login OTP to the volunteer's phone

| Method | Endpoint |
|--------|----------|
| `POST` | `/api/seva/send-otp` |

Sends a 6-digit code to the volunteer's phone (for "log in with phone" flows). Currently the OTP is **logged to the server console** — real SMS/WhatsApp delivery is the one pending integration.

**Request body:**
```json
{ "phone": "9876543210" }
```

**curl:**
```
curl -X POST https://vcc-client.vercel.app/api/seva/send-otp ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"9876543210\"}"
```

**Response (200):** `{ "message": "OTP sent successfully" }`

**Possible errors:**

| Status | Message | Meaning |
|--------|---------|---------|
| `404` | `No volunteer found with this phone number` | This phone isn't registered yet |
| `429` | `Please wait 60 seconds before requesting another OTP` | Rate limit — 1 OTP per minute |

---

### 7. Verify the OTP → get the volunteer's seva data

| Method | Endpoint |
|--------|----------|
| `POST` | `/api/seva/verify-otp` |

Checks the OTP, marks it used, and returns the same data as Step 5 (volunteer profile + all assignments). This is how a volunteer "logs in" without a token.

**Request body:**
```json
{ "phone": "9876543210", "otp": "123456" }
```

**curl:**
```
curl -X POST https://vcc-client.vercel.app/api/seva/verify-otp ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"9876543210\",\"otp\":\"123456\"}"
```

**Response (200):** identical shape to Step 5 (`volunteer` + `registrations`).

**Errors:** `400` → `{ "message": "Invalid or expired OTP" }` (OTP is valid for 10 minutes and can only be used once).

---

### Note — Status changes are admin-only

The old `PUT /api/seva/:registrationId/confirm` and `PUT /api/seva/:registrationId/decline` endpoints have been **removed** along with the `confirmed` status. Volunteers can no longer change their own status — the app only *reads* seva data (profile + assignments + status). All status transitions happen in the admin panel via `PUT /api/registrations/:id/status`.

---

## Part 3 — Status Lifecycle (what the statuses mean)

A registration moves forward through these statuses. This is the "journey" of a volunteer:

```
registered ──▶ assigned ──▶ attended
      │            │            │
      │            └──(admin assigns a service)──▶ assigned
      │
      └──(volunteer backs out)──▶ cancelled
```

| Status | Who sets it | Meaning |
|--------|-------------|---------|
| `registered` | App / website (automatic) | Volunteer signed up for the event |
| `assigned` | Admin | Admin put them on a specific service (Parking, etc.) |
| `attended` | Coordinator | Volunteer showed up on the day |
| `no_show` | Coordinator | They didn't show up |
| `cancelled` | Admin | They backed out |

The mobile app only ever *reads* these statuses. All status changes are admin-side via `PUT /api/registrations/:id/status`.

---

## Part 4 — Full endpoint list (for reference)

### Public (used by mobile app + website — no auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Server + DB health check |
| `GET` | `/api/events/public` | List open/upcoming events |
| `GET` | `/api/events/public/:slug` | Single event by slug |
| `POST` | `/api/registrations` | Register a volunteer for an event |
| `GET` | `/api/volunteers/by-phone/:phone` | Find volunteer by phone |
| `GET` | `/api/volunteers/by-token/:token` | Find volunteer by seva token |
| `GET` | `/api/seva/:token` | Volunteer's seva (by token) |
| `POST` | `/api/seva/send-otp` | Send login OTP |
| `POST` | `/api/seva/verify-otp` | Verify OTP, return seva data |

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
| `GET` | `/api/volunteers/search?q=` | Quick search |
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
| `PUT` | `/api/registrations/:id/status` | Change a registration's status |
| `PUT` | `/api/registrations/:id/service` | Assign one volunteer to a service |
| `PUT` | `/api/registrations/bulk-assign` | Assign many volunteers at once |
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
| `400` | Bad input, invalid OTP, wrong state | Show the `message` to the user |
| `401` | Missing / invalid token (admin only) | Send user to login |
| `403` | Logged in but not enough permission | Show "not allowed" |
| `404` | Not found | Show friendly "not found" message |
| `409` | Already exists (e.g. duplicate registration) | Show "you're already registered" |
| `429` | Rate limited (OTP) | Tell user to wait 60 seconds |
| `500` | Server / database error | Generic error screen + retry |

---

## Part 6 — Registration link (for the website)

Volunteers can also register on the website — same data, same database, same person appears in admin either way.

- **Events list:** `https://vcc-client.vercel.app/events`
- **Direct registration for the current open event (Janmashtami):**
  `https://vcc-client.vercel.app/events/sri-krishna-janmashtami-2026/register`
- **"My Seva" (see assigned work by phone+OTP):** `https://vcc-client.vercel.app/my-seva`

---

## Part 7 — Known limitations / pending items

| Item | Status |
|------|--------|
| OTP delivery (SMS / WhatsApp) | **Pending** — OTP is logged to server console only. Mobile team should NOT ship SMS in production until this is wired. |
| Rate limiting on registration | Basic OTP rate limit exists; registration endpoint not yet rate-limited. |
| Admin JWT for mobile | Not needed — mobile uses only public endpoints. |

---

*Generated for HKM Visakhapatnam. Questions: reach the VCC admin team.*
