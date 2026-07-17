import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reconcileBatch } from "@/lib/reconcile";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { batchId?: string } | null;

  if (!body?.batchId) {
    return NextResponse.json({ error: "batchId is required." }, { status: 400 });
  }

  try {
    const result = await reconcileBatch(user.id, body.batchId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation failed.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
