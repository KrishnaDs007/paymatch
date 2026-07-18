import { NextResponse } from "next/server";
import { normalizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

function loginError(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    if (wantsJson(request)) {
      return NextResponse.json({ error: "invalid" }, { status: 401 });
    }

    return loginError(request);
  }

  if (wantsJson(request)) {
    const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });

    setSessionCookie(response, { id: user.id, email: user.email });

    return response;
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);

  setSessionCookie(response, { id: user.id, email: user.email });

  return response;
}
