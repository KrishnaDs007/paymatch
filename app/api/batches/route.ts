import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getImportBatches } from "@/lib/dashboard";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const batches = await getImportBatches(user.id);

  return NextResponse.json({ batches });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { batchId?: string } | null;

  if (!body?.batchId) {
    return NextResponse.json({ error: "batchId is required." }, { status: 400 });
  }

  const deleted = await db.importBatch.deleteMany({
    where: { id: body.batchId, userId: user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Import batch was not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
