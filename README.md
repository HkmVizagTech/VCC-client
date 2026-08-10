# VCC — Volunteer Care Cell

Next.js 16 app for Volunteer Care Cell — Hare Krishna Movement Visakhapatnam.
**Frontend + API in one app** (the Express backend was migrated into `app/api/*` route handlers).

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in MONGO_URI, JWT_SECRET, SUPER_ADMIN_*
npm run seed                  # first time only — creates super admin
npm run dev                   # app + API on http://localhost:3000
```

## Environment Variables

```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/vcc?retryWrites=true&w=majority
JWT_SECRET=<random 128-char hex>
SUPER_ADMIN_EMAIL=admin@harekrishnavizag.org
SUPER_ADMIN_PASSWORD=<strong password>
SUPER_ADMIN_NAME=Super Admin
```

No `NEXT_PUBLIC_API_URL` needed — the API runs in the same app.

## Pages

| Route | Type | Description |
|-------|------|-------------|
| `/` | Public | Landing page |
| `/events` | Public | Event listing |
| `/events/[slug]/register` | Public | Volunteer registration |
| `/my-seva` | Public | Phone + OTP seva lookup |
| `/my-seva/[token]` | Public | Token-based seva page |
| `/admin` | Protected | Dashboard |
| `/admin/events` | Protected | Event management |
| `/admin/volunteers` | Protected | Volunteer registry |
| `/admin/assignments` | Protected | Assign volunteers to services |
| `/admin/attendance` | Protected | Event day check-in |
| `/admin/reports` | Protected | CSV export |

## API (mobile app + website)

All API endpoints live under `/api/*`. Full reference with curl examples:
- **`API-DOCS.md`** — markdown
- **`API-DOCS.html`** — shareable HTML (give this to the mobile team)

Key public endpoints the mobile app uses: `GET /api/events/public`, `POST /api/registrations`, `GET /api/seva/:token`, `POST /api/seva/send-otp`, `POST /api/seva/verify-otp`, `PUT /api/seva/:id/confirm`, `PUT /api/seva/:id/decline`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run seed` | Create the first super admin |
