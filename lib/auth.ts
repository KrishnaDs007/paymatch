import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const sessionCookieName = "paymatch_session";
const sessionDays = 7;

type SessionPayload = {
  userId: string;
  email: string;
  expiresAt: number;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string | null;
};

type CookieResponse = {
  cookies: {
    set: (
      name: string,
      value: string,
      options: {
        httpOnly: boolean;
        sameSite: "lax";
        secure: boolean;
        path: string;
        maxAge: number;
      },
    ) => void;
  };
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }

  return secret;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function sign(value: string) {
  return toBase64Url(createHmac("sha256", getSessionSecret()).update(value).digest());
}

function signaturesMatch(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string) {
  return password.length >= 8;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function createSessionToken(user: AuthUser) {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    expiresAt: Date.now() + sessionDays * 24 * 60 * 60 * 1000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !signaturesMatch(sign(encodedPayload), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;

    if (!payload.userId || payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const payload = readSessionToken(token);

  if (!payload) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, fullName: true },
  });

  return user;
}

export function setSessionCookie(response: CookieResponse, user: AuthUser) {
  response.cookies.set(sessionCookieName, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDays * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: CookieResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
