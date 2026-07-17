import { NextResponse } from "next/server";
import { normalizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

function loginError(request: Request) {
  return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return loginError(request);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);

  setSessionCookie(response, { id: user.id, email: user.email });

  return response;
}
