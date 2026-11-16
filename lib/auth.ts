import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export type AppRole = "student" | "recruiter";

export interface Session {
  userId: string;
  role: AppRole;
  expiresAt: number;
}

export const SESSION_COOKIE_NAME = "job_matcher_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret(): string {
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be configured in production");
  }
  return process.env.SESSION_SECRET ?? "local-development-session-secret";
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function createToken(session: Session): string {
  const payload = encode(JSON.stringify(session));
  return `${payload}.${signature(payload)}`;
}

function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;

  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const session = JSON.parse(decode(payload)) as Session;
    if (
      (session.role !== "student" && session.role !== "recruiter") ||
      typeof session.userId !== "string" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getSession(request: NextRequest): Session | null {
  return verifyToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function setSession(response: NextResponse, userId: string, role: AppRole): void {
  const session: Session = {
    userId,
    role,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createToken(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export function clearSession(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export function requireRole(
  request: NextRequest,
  role: AppRole
): Session | NextResponse {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (session.role !== role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export function isSession(value: Session | NextResponse): value is Session {
  return "userId" in value;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 255
    ? email
    : null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    return null;
  }
  return value;
}

export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{1,64}$/u.test(value);
}
