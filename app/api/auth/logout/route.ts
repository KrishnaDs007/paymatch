import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);

  clearSessionCookie(response);

  return response;
}
