# VCC Client

Next.js 16 frontend for Volunteer Care Cell — Hare Krishna Movement Visakhapatnam.

## Quick Start

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8081" > .env.local
npm run dev    # runs on http://localhost:3000
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=https://your-railway-server.up.railway.app
```

## Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Public | Landing page |
| `/events` | Public | Event listing |
| `/events/[slug]/register` | Public | Volunteer registration |
| `/my-seva` | Public | Phone + OTP seva lookup |
| `/my-seva/[token]` | Public | Token-based seva page |
| `/admin` | Protected | Dashboard |
| `/admin/assignments` | Protected | Assign volunteers to services |
| `/admin/attendance` | Protected | Event day check-in |
| `/admin/reports` | Protected | CSV export |

See full documentation in the [main README](../README.md).
