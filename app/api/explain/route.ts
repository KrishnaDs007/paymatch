import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { explainDiscrepancy } from "@/lib/explain";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { discrepancyId?: string } | null;

  if (!body?.discrepancyId) {
    return NextResponse.json({ error: "discrepancyId is required." }, { status: 400 });
  }

  const result = await explainDiscrepancy(user.id, body.discrepancyId);

  if (!result) {
    return NextResponse.json({ error: "Discrepancy was not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
