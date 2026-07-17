import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const batchId = url.searchParams.get("batchId") ?? undefined;
  const summary = await getDashboardSummary(user.id, batchId);

  if (!summary) {
    return NextResponse.json({ error: "No import batch was found." }, { status: 404 });
  }

  return NextResponse.json(summary);
}
