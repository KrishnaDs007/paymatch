import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDiscrepancyPage } from "@/lib/dashboard";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const page = await getDiscrepancyPage(user.id, request.url);

  if (!page) {
    return NextResponse.json({ error: "No import batch was found." }, { status: 404 });
  }

  return NextResponse.json(page);
}
