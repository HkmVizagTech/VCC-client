import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_API_PREFIXES = [
  "/api/events/public",
  "/api/registrations",
  "/api/volunteers/by-phone",
  "/api/seva",
  "/api/devotees",
  "/api/upload",
];

const ALLOWED_ORIGINS = [
  "https://www.harekrishnavizag.org",
  "https://harekrishnavizag.org",
  "http://localhost:3001",
  "http://localhost:3002",
];

function isPublicApi(path: string) {
  return PUBLIC_API_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function withCors(res: NextResponse, origin: string | null) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isPublicApi(pathname)) return NextResponse.next();

  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }), origin);
  }

  const res = NextResponse.next();
  return withCors(res, origin);
}

export const config = {
  matcher: [
    "/api/events/public/:path*",
    "/api/events/public",
    "/api/registrations/:path*",
    "/api/registrations",
    "/api/volunteers/by-phone/:path*",
    "/api/seva/:path*",
    "/api/devotees/:path*",
    "/api/devotees",
    "/api/upload/:path*",
    "/api/upload",
  ],
};
