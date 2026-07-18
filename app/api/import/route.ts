import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ImportError, importCsvData } from "@/lib/import-data";
import { getMaxImportBatches } from "@/lib/import-limits";

const maxFileSize = 2 * 1024 * 1024;
const allowedTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "text/plain",
  "",
]);

async function readCsvFile(formData: FormData, name: string) {
  const value = formData.get(name);

  if (!(value instanceof File)) {
    throw new ImportError(`${name} file is required.`);
  }

  if (value.size === 0) {
    throw new ImportError(`${name} file is empty.`);
  }

  if (value.size > maxFileSize) {
    throw new ImportError(`${name} file is too large. Use a CSV under 2 MB.`);
  }

  if (!value.name.toLowerCase().endsWith(".csv")) {
    throw new ImportError(`${name} must be a .csv file.`);
  }

  if (!allowedTypes.has(value.type)) {
    throw new ImportError(`${name} has unsupported file type: ${value.type}.`);
  }

  return value.text();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const batchName = String(formData.get("batchName") ?? "").trim();
    const maxImportBatches = getMaxImportBatches();
    const batchCount = await db.importBatch.count({ where: { userId: user.id } });

    if (batchName.length < 2) {
      throw new ImportError("Batch name is required.");
    }

    if (batchCount >= maxImportBatches) {
      throw new ImportError(
        `You can keep up to ${maxImportBatches} import batches. Delete an older batch before uploading a new one.`,
      );
    }

    const ordersCsv = await readCsvFile(formData, "orders");
    const paymentsCsv = await readCsvFile(formData, "payments");
    const result = await importCsvData({
      userId: user.id,
      ordersCsv,
      paymentsCsv,
      batchName,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}
