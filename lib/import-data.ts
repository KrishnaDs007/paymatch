import { parse } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type CsvRow = Record<string, string>;

const orderColumns = [
  "order_id",
  "order_date",
  "customer_email",
  "currency",
  "gross_amount",
  "discount",
  "net_amount",
  "status",
];

const paymentColumns = [
  "transaction_ref",
  "processed_at",
  "order_reference",
  "currency",
  "amount",
  "fee",
  "net_settled",
  "type",
  "status",
];

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

function parseCsv(content: string, requiredColumns: string[], label: string) {
  let rows: CsvRow[];

  try {
    rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: false,
      bom: true,
    }) as CsvRow[];
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown parser error";

    throw new ImportError(`${label} CSV could not be parsed. ${detail}`);
  }

  const firstRow = rows[0];

  if (!firstRow) {
    throw new ImportError(`${label} CSV is empty.`);
  }

  const missingColumns = requiredColumns.filter((column) => !(column in firstRow));

  if (missingColumns.length > 0) {
    throw new ImportError(`${label} CSV is missing: ${missingColumns.join(", ")}.`);
  }

  return rows;
}

export function normalizeReference(value: string) {
  return value.trim().toUpperCase();
}

function cleanText(value: string | undefined) {
  return String(value ?? "").trim();
}

function cleanStatus(value: string | undefined) {
  return cleanText(value).toLowerCase();
}

function cleanCurrency(value: string | undefined) {
  return cleanText(value).toUpperCase();
}

function requireText(value: string | undefined, field: string) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    throw new ImportError(`${field} is required.`);
  }

  return cleaned;
}

function parseMoneyCents(value: string | undefined, field: string) {
  const cleaned = cleanText(value);
  const amount = Number(cleaned);

  if (!cleaned || Number.isNaN(amount) || !Number.isFinite(amount)) {
    throw new ImportError(`${field} contains an invalid amount.`);
  }

  return Math.round(amount * 100);
}

function parseOptionalMoneyCents(value: string | undefined, field: string) {
  const cleaned = cleanText(value);

  return cleaned ? parseMoneyCents(cleaned, field) : 0;
}

function parseOrderDate(value: string | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const date = new Date(`${cleaned.replace(" ", "T")}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePaymentDate(value: string | undefined) {
  const cleaned = cleanText(value);
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(cleaned);

  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function mapOrder(row: CsvRow, batchId: string, userId: string) {
  const rowNumber = row.__rowNumber;
  const { __rowNumber, ...rawData } = row;
  const orderId = requireText(row.order_id, `orders CSV row ${rowNumber} order_id`);

  return {
    batchId,
    userId,
    orderId,
    normalizedOrderId: normalizeReference(orderId),
    orderDate: parseOrderDate(row.order_date),
    customerEmail: cleanText(row.customer_email).toLowerCase(),
    currency: cleanCurrency(requireText(row.currency, `orders CSV row ${rowNumber} currency`)),
    grossAmountCents: parseMoneyCents(
      row.gross_amount,
      `orders CSV row ${rowNumber} gross_amount`,
    ),
    discountCents: parseOptionalMoneyCents(row.discount, `orders CSV row ${rowNumber} discount`),
    netAmountCents: parseMoneyCents(row.net_amount, `orders CSV row ${rowNumber} net_amount`),
    status: cleanStatus(requireText(row.status, `orders CSV row ${rowNumber} status`)),
    rawData: rawData as Prisma.InputJsonObject,
  };
}

function mapPayment(row: CsvRow, batchId: string, userId: string) {
  const rowNumber = row.__rowNumber;
  const { __rowNumber, ...rawData } = row;
  const transactionRef = requireText(
    row.transaction_ref,
    `payments CSV row ${rowNumber} transaction_ref`,
  );
  const orderReference = requireText(
    row.order_reference,
    `payments CSV row ${rowNumber} order_reference`,
  );

  return {
    batchId,
    userId,
    transactionRef,
    processedAt: parsePaymentDate(row.processed_at),
    orderReference,
    normalizedOrderReference: normalizeReference(orderReference),
    currency: cleanCurrency(requireText(row.currency, `payments CSV row ${rowNumber} currency`)),
    amountCents: parseMoneyCents(row.amount, `payments CSV row ${rowNumber} amount`),
    feeCents: parseMoneyCents(row.fee, `payments CSV row ${rowNumber} fee`),
    netSettledCents: parseMoneyCents(
      row.net_settled,
      `payments CSV row ${rowNumber} net_settled`,
    ),
    type: cleanStatus(requireText(row.type, `payments CSV row ${rowNumber} type`)),
    status: cleanStatus(requireText(row.status, `payments CSV row ${rowNumber} status`)),
    rawData: rawData as Prisma.InputJsonObject,
  };
}

export async function importCsvData({
  userId,
  ordersCsv,
  paymentsCsv,
  batchName,
}: {
  userId: string;
  ordersCsv: string;
  paymentsCsv: string;
  batchName: string;
}) {
  const orderRows = parseCsv(ordersCsv, orderColumns, "orders");
  const paymentRows = parseCsv(paymentsCsv, paymentColumns, "payments");

  return db.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        userId,
        name: batchName.trim(),
      },
    });

    const orders = orderRows.map((row, index) =>
      mapOrder({ ...row, __rowNumber: String(index + 2) }, batch.id, userId),
    );
    const payments = paymentRows.map((row, index) =>
      mapPayment({ ...row, __rowNumber: String(index + 2) }, batch.id, userId),
    );

    await tx.orderRow.createMany({ data: orders });
    await tx.paymentRow.createMany({ data: payments });

    return {
      batchId: batch.id,
      orderCount: orders.length,
      paymentCount: payments.length,
    };
  });
}
