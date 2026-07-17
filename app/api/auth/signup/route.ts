import { NextResponse } from "next/server";
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  setSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/db";

function redirectWithError(request: Request, path: string, error: string) {
  return NextResponse.redirect(new URL(`${path}?error=${error}`, request.url), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!isValidEmail(email)) {
    return redirectWithError(request, "/signup", "email");
  }

  if (!isValidPassword(password)) {
    return redirectWithError(request, "/signup", "password");
  }

  const existingUser = await db.user.findUnique({ where: { email } });

  if (existingUser) {
    return redirectWithError(request, "/signup", "exists");
  }

  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
    },
    select: { id: true, email: true },
  });
  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);

  setSessionCookie(response, user);

  return response;
}
