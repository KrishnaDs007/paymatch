import { DiscrepancyType, Prisma, Severity } from "@prisma/client";
import { db } from "@/lib/db";

type OrderForReconcile = {
  id: string;
  orderId: string;
  normalizedOrderId: string;
  customerEmail: string;
  currency: string;
  netAmountCents: number;
  status: string;
};

type PaymentForReconcile = {
  id: string;
  transactionRef: string;
  orderReference: string;
  normalizedOrderReference: string;
  currency: string;
  amountCents: number;
  type: string;
  status: string;
};

type NewDiscrepancy = {
  type: DiscrepancyType;
  severity: Severity;
  orderId?: string;
  paymentId?: string;
  expectedAmountCents?: number;
  actualAmountCents?: number;
  differenceAmountCents?: number;
  currency?: string;
  summary: string;
  suggestedAction: string;
  details: Prisma.InputJsonObject;
};

const moneyToleranceCents = 1;

function groupByReference(payments: PaymentForReconcile[]) {
  const groups = new Map<string, PaymentForReconcile[]>();

  for (const payment of payments) {
    const existing = groups.get(payment.normalizedOrderReference) ?? [];
    existing.push(payment);
    groups.set(payment.normalizedOrderReference, existing);
  }

  return groups;
}

function isSettledCharge(payment: PaymentForReconcile) {
  return payment.type === "charge" && payment.status === "settled";
}

function isUnsettledCharge(payment: PaymentForReconcile) {
  return payment.type === "charge" && payment.status !== "settled";
}

function isRefund(payment: PaymentForReconcile) {
  return payment.type === "refund";
}

function amountDifference(order: OrderForReconcile, payment: PaymentForReconcile) {
  return payment.amountCents - order.netAmountCents;
}

function addReferenceFormatIssue(
  discrepancies: NewDiscrepancy[],
  order: OrderForReconcile,
  payment: PaymentForReconcile,
) {
  if (order.orderId === payment.orderReference) {
    return;
  }

  discrepancies.push({
    type: "REFERENCE_FORMAT_MISMATCH",
    severity: "LOW",
    orderId: order.id,
    paymentId: payment.id,
    currency: order.currency,
    summary: `Order ${order.orderId} matched payment ${payment.transactionRef} only after reference normalization.`,
    suggestedAction: "Clean the payment reference format so future exports match exactly.",
    details: {
      orderId: order.orderId,
      paymentReference: payment.orderReference,
      normalizedReference: order.normalizedOrderId,
    },
  });
}

function addPaymentQualityIssues(
  discrepancies: NewDiscrepancy[],
  order: OrderForReconcile,
  payments: PaymentForReconcile[],
) {
  for (const payment of payments) {
    if (isUnsettledCharge(payment)) {
      discrepancies.push({
        type: "PENDING_OR_FAILED_PAYMENT",
        severity: "MEDIUM",
        orderId: order.id,
        paymentId: payment.id,
        expectedAmountCents: order.netAmountCents,
        actualAmountCents: payment.amountCents,
        differenceAmountCents: payment.amountCents - order.netAmountCents,
        currency: order.currency,
        summary: `Order ${order.orderId} has a ${payment.status} charge instead of a settled charge.`,
        suggestedAction: "Check the payment processor and follow up before treating this order as paid.",
        details: {
          orderId: order.orderId,
          transactionRef: payment.transactionRef,
          paymentStatus: payment.status,
          paymentType: payment.type,
        },
      });
    }

    if (isRefund(payment)) {
      if (order.status === "refunded") {
        continue;
      }

      const refundOnCompletedOrder = order.status === "completed";

      discrepancies.push({
        type: "REFUND_PRESENT",
        severity: refundOnCompletedOrder ? "MEDIUM" : "LOW",
        orderId: order.id,
        paymentId: payment.id,
        expectedAmountCents: order.netAmountCents,
        actualAmountCents: payment.amountCents,
        currency: order.currency,
        summary: `Order ${order.orderId} has a settled refund payment.`,
        suggestedAction: refundOnCompletedOrder
          ? "Review why a completed order was refunded."
          : "Confirm the refund matches the order status.",
        details: {
          orderId: order.orderId,
          transactionRef: payment.transactionRef,
          orderStatus: order.status,
          paymentStatus: payment.status,
        },
      });
    }
  }
}

function addCompletedOrderIssues(
  discrepancies: NewDiscrepancy[],
  order: OrderForReconcile,
  settledCharges: PaymentForReconcile[],
  allPayments: PaymentForReconcile[],
) {
  if (settledCharges.length === 0) {
    const hasUnsettledCharge = allPayments.some(isUnsettledCharge);

    if (hasUnsettledCharge) {
      return;
    }

    discrepancies.push({
      type: "MISSING_PAYMENT",
      severity: "HIGH",
      orderId: order.id,
      expectedAmountCents: order.netAmountCents,
      actualAmountCents: 0,
      differenceAmountCents: -order.netAmountCents,
      currency: order.currency,
      summary: `Completed order ${order.orderId} has no settled charge.`,
      suggestedAction: "Find or collect the missing payment before fulfilling revenue reporting.",
      details: {
        orderId: order.orderId,
        orderStatus: order.status,
        relatedPaymentCount: allPayments.length,
      },
    });
    return;
  }

  if (settledCharges.length > 1) {
    const actualAmount = settledCharges.reduce((sum, payment) => sum + payment.amountCents, 0);

    discrepancies.push({
      type: "DUPLICATE_CHARGE",
      severity: "HIGH",
      orderId: order.id,
      paymentId: settledCharges[0].id,
      expectedAmountCents: order.netAmountCents,
      actualAmountCents: actualAmount,
      differenceAmountCents: actualAmount - order.netAmountCents,
      currency: order.currency,
      summary: `Completed order ${order.orderId} has ${settledCharges.length} settled charges.`,
      suggestedAction: "Review duplicate charges and refund any extra customer charge.",
      details: {
        orderId: order.orderId,
        transactionRefs: settledCharges.map((payment) => payment.transactionRef),
      },
    });
  }

  for (const payment of settledCharges) {
    addReferenceFormatIssue(discrepancies, order, payment);

    if (order.currency !== payment.currency) {
      discrepancies.push({
        type: "CURRENCY_MISMATCH",
        severity: "HIGH",
        orderId: order.id,
        paymentId: payment.id,
        expectedAmountCents: order.netAmountCents,
        actualAmountCents: payment.amountCents,
        differenceAmountCents: amountDifference(order, payment),
        currency: order.currency,
        summary: `Order ${order.orderId} is in ${order.currency}, but payment ${payment.transactionRef} is in ${payment.currency}.`,
        suggestedAction: "Confirm the correct currency and fix the order or processor record.",
        details: {
          orderId: order.orderId,
          transactionRef: payment.transactionRef,
          orderCurrency: order.currency,
          paymentCurrency: payment.currency,
        },
      });
      continue;
    }

    const difference = amountDifference(order, payment);

    if (Math.abs(difference) > moneyToleranceCents) {
      discrepancies.push({
        type: "AMOUNT_MISMATCH",
        severity: "MEDIUM",
        orderId: order.id,
        paymentId: payment.id,
        expectedAmountCents: order.netAmountCents,
        actualAmountCents: payment.amountCents,
        differenceAmountCents: difference,
        currency: order.currency,
        summary: `Order ${order.orderId} expected one amount but payment ${payment.transactionRef} settled for another.`,
        suggestedAction: "Compare order discounts/taxes with the processor charge and correct the source record.",
        details: {
          orderId: order.orderId,
          transactionRef: payment.transactionRef,
          toleranceCents: moneyToleranceCents,
        },
      });
    }
  }
}

function addStatusIssues(
  discrepancies: NewDiscrepancy[],
  order: OrderForReconcile,
  settledCharges: PaymentForReconcile[],
  allPayments: PaymentForReconcile[],
) {
  if (order.status === "completed" || settledCharges.length === 0) {
    return;
  }

  if (order.status === "refunded" && allPayments.some(isRefund)) {
    return;
  }

  for (const payment of settledCharges) {
    discrepancies.push({
      type: "STATUS_MISMATCH",
      severity: order.status === "cancelled" ? "HIGH" : "MEDIUM",
      orderId: order.id,
      paymentId: payment.id,
      expectedAmountCents: 0,
      actualAmountCents: payment.amountCents,
      differenceAmountCents: payment.amountCents,
      currency: order.currency,
      summary: `Order ${order.orderId} is ${order.status}, but it has a settled charge.`,
      suggestedAction: "Check whether the charge should be refunded or the order status corrected.",
      details: {
        orderId: order.orderId,
        orderStatus: order.status,
        transactionRef: payment.transactionRef,
      },
    });
  }
}

function addOrphanPayments(
  discrepancies: NewDiscrepancy[],
  ordersByReference: Map<string, OrderForReconcile>,
  payments: PaymentForReconcile[],
) {
  for (const payment of payments) {
    if (ordersByReference.has(payment.normalizedOrderReference)) {
      continue;
    }

    discrepancies.push({
      type: "ORPHAN_PAYMENT",
      severity: isSettledCharge(payment) ? "HIGH" : "MEDIUM",
      paymentId: payment.id,
      actualAmountCents: payment.amountCents,
      currency: payment.currency,
      summary: `Payment ${payment.transactionRef} references ${payment.orderReference}, but no order was found.`,
      suggestedAction: "Find the missing order record or correct the payment reference.",
      details: {
        transactionRef: payment.transactionRef,
        paymentReference: payment.orderReference,
        normalizedReference: payment.normalizedOrderReference,
        paymentType: payment.type,
        paymentStatus: payment.status,
      },
    });
  }
}

export function findDiscrepancies(
  orders: OrderForReconcile[],
  payments: PaymentForReconcile[],
) {
  const discrepancies: NewDiscrepancy[] = [];
  const paymentsByReference = groupByReference(payments);
  const ordersByReference = new Map(orders.map((order) => [order.normalizedOrderId, order]));

  for (const order of orders) {
    const relatedPayments = paymentsByReference.get(order.normalizedOrderId) ?? [];
    const settledCharges = relatedPayments.filter(isSettledCharge);

    addPaymentQualityIssues(discrepancies, order, relatedPayments);

    if (order.status === "completed") {
      addCompletedOrderIssues(discrepancies, order, settledCharges, relatedPayments);
    } else {
      addStatusIssues(discrepancies, order, settledCharges, relatedPayments);
    }
  }

  addOrphanPayments(discrepancies, ordersByReference, payments);

  return discrepancies;
}

export async function reconcileBatch(userId: string, batchId: string) {
  const batch = await db.importBatch.findFirst({
    where: { id: batchId, userId },
    select: { id: true },
  });

  if (!batch) {
    throw new Error("Import batch was not found.");
  }

  const [orders, payments] = await Promise.all([
    db.orderRow.findMany({
      where: { batchId, userId },
      select: {
        id: true,
        orderId: true,
        normalizedOrderId: true,
        customerEmail: true,
        currency: true,
        netAmountCents: true,
        status: true,
      },
      orderBy: { orderId: "asc" },
    }),
    db.paymentRow.findMany({
      where: { batchId, userId },
      select: {
        id: true,
        transactionRef: true,
        orderReference: true,
        normalizedOrderReference: true,
        currency: true,
        amountCents: true,
        type: true,
        status: true,
      },
      orderBy: { transactionRef: "asc" },
    }),
  ]);

  const discrepancies = findDiscrepancies(orders, payments);

  await db.$transaction(async (tx) => {
    await tx.discrepancy.deleteMany({ where: { batchId, userId } });

    if (discrepancies.length === 0) {
      return;
    }

    await tx.discrepancy.createMany({
      data: discrepancies.map((discrepancy) => ({
        batchId,
        userId,
        type: discrepancy.type,
        severity: discrepancy.severity,
        orderId: discrepancy.orderId,
        paymentId: discrepancy.paymentId,
        expectedAmountCents: discrepancy.expectedAmountCents,
        actualAmountCents: discrepancy.actualAmountCents,
        differenceAmountCents: discrepancy.differenceAmountCents,
        currency: discrepancy.currency,
        summary: discrepancy.summary,
        suggestedAction: discrepancy.suggestedAction,
        details: discrepancy.details,
      })),
    });
  });

  return {
    batchId,
    orderCount: orders.length,
    paymentCount: payments.length,
    discrepancyCount: discrepancies.length,
    countsByType: discrepancies.reduce<Record<string, number>>((counts, discrepancy) => {
      counts[discrepancy.type] = (counts[discrepancy.type] ?? 0) + 1;
      return counts;
    }, {}),
  };
}
