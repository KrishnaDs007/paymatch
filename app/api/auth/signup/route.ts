import { NextResponse } from "next/server";
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from "@/lib/auth";
import { db } from "@/lib/db";

function errorResponse(request: Request, error: string) {
  if (wantsJson(request)) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/signup", request.url), 303);
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function isValidFullName(fullName: string) {
  return fullName.length >= 2 && fullName.length <= 80 && !/[<>]/.test(fullName);
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/signup", request.url), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isValidFullName(fullName)) {
    return errorResponse(request, "name");
  }

  if (!isValidEmail(email)) {
    return errorResponse(request, "email");
  }

  if (!isValidPassword(password)) {
    return errorResponse(request, "password");
  }

  if (password !== confirmPassword) {
    return errorResponse(request, "confirm");
  }

  const existingUser = await db.user.findUnique({ where: { email } });

  if (existingUser) {
    return errorResponse(request, "exists");
  }

  await db.user.create({
    data: {
      fullName,
      email,
      passwordHash: await hashPassword(password),
    },
  });

  if (wantsJson(request)) {
    return NextResponse.json(
      {
        ok: true,
        message: "Account created successfully. Redirecting to login...",
        redirectTo: "/login",
      },
      { status: 201 },
    );
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);

  return response;
}
