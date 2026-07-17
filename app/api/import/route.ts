import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ImportError, importCsvData } from "@/lib/import-data";

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
    const ordersCsv = await readCsvFile(formData, "orders");
    const paymentsCsv = await readCsvFile(formData, "payments");
    const batchName = String(formData.get("batchName") ?? "");
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
