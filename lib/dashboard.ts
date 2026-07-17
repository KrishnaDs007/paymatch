import { DiscrepancyType, Prisma, Severity } from "@prisma/client";
import { db } from "@/lib/db";

const ignoredRiskTypes = new Set<DiscrepancyType>(["REFERENCE_FORMAT_MISMATCH"]);

type DiscrepancyWithRows = Prisma.DiscrepancyGetPayload<{
  include: {
    order: {
      select: {
        orderId: true;
        customerEmail: true;
        status: true;
        netAmountCents: true;
      };
    };
    payment: {
      select: {
        transactionRef: true;
        orderReference: true;
        status: true;
        type: true;
        amountCents: true;
      };
    };
  };
}>;

function riskForDiscrepancy(discrepancy: {
  type: DiscrepancyType;
  expectedAmountCents: number | null;
  actualAmountCents: number | null;
  differenceAmountCents: number | null;
}) {
  if (ignoredRiskTypes.has(discrepancy.type)) {
    return 0;
  }

  if (discrepancy.type === "MISSING_PAYMENT") {
    return Math.abs(discrepancy.expectedAmountCents ?? 0);
  }

  if (discrepancy.type === "ORPHAN_PAYMENT") {
    return Math.abs(discrepancy.actualAmountCents ?? 0);
  }

  if (
    discrepancy.type === "CURRENCY_MISMATCH" ||
    discrepancy.type === "PENDING_OR_FAILED_PAYMENT"
  ) {
    return Math.abs(discrepancy.expectedAmountCents ?? discrepancy.actualAmountCents ?? 0);
  }

  if (discrepancy.type === "REFUND_PRESENT" || discrepancy.type === "STATUS_MISMATCH") {
    return Math.abs(discrepancy.actualAmountCents ?? discrepancy.expectedAmountCents ?? 0);
  }

  if (discrepancy.differenceAmountCents !== null) {
    return Math.abs(discrepancy.differenceAmountCents);
  }

  return Math.abs(discrepancy.actualAmountCents ?? discrepancy.expectedAmountCents ?? 0);
}

function cleanQuery(value: string | null) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : undefined;
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return fallback;
  }

  return Math.min(numberValue, max);
}

function parseDiscrepancyType(value: string | null) {
  if (!value) {
    return undefined;
  }

  return Object.values(DiscrepancyType).includes(value as DiscrepancyType)
    ? (value as DiscrepancyType)
    : undefined;
}

function parseSeverity(value: string | null) {
  if (!value) {
    return undefined;
  }

  return Object.values(Severity).includes(value as Severity) ? (value as Severity) : undefined;
}

export async function getBatchForDashboard(userId: string, batchId?: string) {
  if (batchId) {
    return db.importBatch.findFirst({
      where: { id: batchId, userId },
      select: { id: true, name: true, createdAt: true },
    });
  }

  return db.importBatch.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });
}

export async function getDashboardSummary(userId: string, batchId?: string) {
  const batch = await getBatchForDashboard(userId, batchId);

  if (!batch) {
    return null;
  }

  const orders = await db.orderRow.findMany({
    where: { userId, batchId: batch.id },
    select: {
      id: true,
      status: true,
      netAmountCents: true,
    },
  });
  const payments = await db.paymentRow.findMany({
    where: { userId, batchId: batch.id },
    select: {
      type: true,
      status: true,
      amountCents: true,
    },
  });
  const discrepancies = await db.discrepancy.findMany({
    where: { userId, batchId: batch.id },
    select: {
      type: true,
      severity: true,
      orderId: true,
      expectedAmountCents: true,
      actualAmountCents: true,
      differenceAmountCents: true,
    },
  });

  const disputedOrderIds = new Set(
    discrepancies
      .filter((discrepancy) => discrepancy.type !== "REFERENCE_FORMAT_MISMATCH")
      .map((discrepancy) => discrepancy.orderId)
      .filter(Boolean),
  );
  const completedOrders = orders.filter((order) => order.status === "completed");
  const completedOrderValueCents = completedOrders.reduce(
    (sum, order) => sum + order.netAmountCents,
    0,
  );
  const settledChargeValueCents = payments
    .filter((payment) => payment.type === "charge" && payment.status === "settled")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const reconciledValueCents = completedOrders
    .filter((order) => !disputedOrderIds.has(order.id))
    .reduce((sum, order) => sum + order.netAmountCents, 0);
  const breakdownMap = new Map<
    DiscrepancyType,
    { type: DiscrepancyType; count: number; riskCents: number }
  >();
  const severityMap = new Map<Severity, number>();
  let moneyAtRiskCents = 0;

  for (const discrepancy of discrepancies) {
    const riskCents = riskForDiscrepancy(discrepancy);
    const currentType = breakdownMap.get(discrepancy.type) ?? {
      type: discrepancy.type,
      count: 0,
      riskCents: 0,
    };

    currentType.count += 1;
    currentType.riskCents += riskCents;
    breakdownMap.set(discrepancy.type, currentType);
    severityMap.set(discrepancy.severity, (severityMap.get(discrepancy.severity) ?? 0) + 1);
    moneyAtRiskCents += riskCents;
  }

  return {
    batch,
    metrics: {
      totalOrders: orders.length,
      totalPayments: payments.length,
      completedOrderValueCents,
      settledChargeValueCents,
      reconciledValueCents,
      disputedValueCents: moneyAtRiskCents,
      moneyAtRiskCents,
      discrepancyCount: discrepancies.length,
    },
    breakdownByType: Array.from(breakdownMap.values()).sort((first, second) =>
      first.type.localeCompare(second.type),
    ),
    breakdownBySeverity: Array.from(severityMap.entries()).map(([severity, count]) => ({
      severity,
      count,
    })),
  };
}

function mapDiscrepancy(discrepancy: DiscrepancyWithRows) {
  return {
    id: discrepancy.id,
    type: discrepancy.type,
    severity: discrepancy.severity,
    orderId: discrepancy.order?.orderId ?? null,
    transactionRef: discrepancy.payment?.transactionRef ?? null,
    paymentReference: discrepancy.payment?.orderReference ?? null,
    customerEmail: discrepancy.order?.customerEmail ?? null,
    orderStatus: discrepancy.order?.status ?? null,
    paymentStatus: discrepancy.payment?.status ?? null,
    paymentType: discrepancy.payment?.type ?? null,
    expectedAmountCents: discrepancy.expectedAmountCents,
    actualAmountCents: discrepancy.actualAmountCents,
    differenceAmountCents: discrepancy.differenceAmountCents,
    riskCents: riskForDiscrepancy(discrepancy),
    currency: discrepancy.currency,
    summary: discrepancy.summary,
    suggestedAction: discrepancy.suggestedAction,
    createdAt: discrepancy.createdAt,
  };
}

export async function getDiscrepancyPage(userId: string, requestUrl: string) {
  const url = new URL(requestUrl);
  const batch = await getBatchForDashboard(userId, cleanQuery(url.searchParams.get("batchId")));

  if (!batch) {
    return null;
  }

  const page = parsePositiveInt(url.searchParams.get("page"), 1, 10000);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 25, 100);
  const search = cleanQuery(url.searchParams.get("search"));
  const type = parseDiscrepancyType(url.searchParams.get("type"));
  const severity = parseSeverity(url.searchParams.get("severity"));
  const where: Prisma.DiscrepancyWhereInput = {
    userId,
    batchId: batch.id,
    ...(type ? { type } : {}),
    ...(severity ? { severity } : {}),
    ...(search
      ? {
          OR: [
            { summary: { contains: search, mode: "insensitive" } },
            { suggestedAction: { contains: search, mode: "insensitive" } },
            { order: { orderId: { contains: search, mode: "insensitive" } } },
            { order: { customerEmail: { contains: search, mode: "insensitive" } } },
            { payment: { transactionRef: { contains: search, mode: "insensitive" } } },
            { payment: { orderReference: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const total = await db.discrepancy.count({ where });
  const rows = await db.discrepancy.findMany({
    where,
    include: {
      order: {
        select: {
          orderId: true,
          customerEmail: true,
          status: true,
          netAmountCents: true,
        },
      },
      payment: {
        select: {
          transactionRef: true,
          orderReference: true,
          status: true,
          type: true,
          amountCents: true,
        },
      },
    },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    batch,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: {
      search: search ?? null,
      type: type ?? null,
      severity: severity ?? null,
    },
    rows: rows.map(mapDiscrepancy),
  };
}
