import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

export function generateToken(payload: {
  userId: string;
  role: string;
}): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

interface AuthPayload {
  userId: string;
  role: "super_admin" | "event_coordinator" | "service_coordinator";
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies.get("token")?.value || null;
}

export async function authenticate(
  req: NextRequest
): Promise<AuthPayload | NextResponse> {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json(
      { message: "Access denied. No token provided." },
      { status: 401 }
    );
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return NextResponse.json(
      { message: "Invalid or expired token." },
      { status: 401 }
    );
  }
  return decoded;
}

type Role = "super_admin" | "event_coordinator" | "service_coordinator";

const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 3,
  event_coordinator: 2,
  service_coordinator: 1,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

export async function authenticateWithRole(
  req: NextRequest,
  minRole: Role
): Promise<AuthPayload | NextResponse> {
  const result = await authenticate(req);
  if (result instanceof NextResponse) return result;

  if (!hasMinRole(result.role, minRole)) {
    return NextResponse.json(
      { message: "Access denied. Insufficient permissions." },
      { status: 403 }
    );
  }
  return result;
}

export function setAuthCookie(response: NextResponse, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 0,
    path: "/",
  });
}
