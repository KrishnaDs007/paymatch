import OpenAI from "openai";
import { db } from "@/lib/db";

type Explanation = {
  title: string;
  plainLanguageSummary: string;
  likelyCause: string;
  recommendedAction: string;
  risk: string;
};

type DiscrepancyForExplain = NonNullable<Awaited<ReturnType<typeof getDiscrepancyForExplain>>>;

const explanationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    plainLanguageSummary: { type: "string" },
    likelyCause: { type: "string" },
    recommendedAction: { type: "string" },
    risk: { type: "string" },
  },
  required: [
    "title",
    "plainLanguageSummary",
    "likelyCause",
    "recommendedAction",
    "risk",
  ],
} as const;

function formatMoney(cents: number | null, currency: string | null) {
  if (cents === null) {
    return "not available";
  }

  return `${currency ?? "USD"} ${(cents / 100).toFixed(2)}`;
}

function isExplanation(value: unknown): value is Explanation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.title === "string" &&
    typeof candidate.plainLanguageSummary === "string" &&
    typeof candidate.likelyCause === "string" &&
    typeof candidate.recommendedAction === "string" &&
    typeof candidate.risk === "string"
  );
}

async function getDiscrepancyForExplain(userId: string, discrepancyId: string) {
  return db.discrepancy.findFirst({
    where: { id: discrepancyId, userId },
    include: {
      order: {
        select: {
          orderId: true,
          customerEmail: true,
          currency: true,
          netAmountCents: true,
          status: true,
        },
      },
      payment: {
        select: {
          transactionRef: true,
          orderReference: true,
          currency: true,
          amountCents: true,
          feeCents: true,
          netSettledCents: true,
          type: true,
          status: true,
        },
      },
    },
  });
}

function fallbackExplanation(discrepancy: DiscrepancyForExplain): Explanation {
  return {
    title: discrepancy.type.replaceAll("_", " ").toLowerCase(),
    plainLanguageSummary: discrepancy.summary,
    likelyCause:
      "The deterministic reconciliation rules found that the order and payment records do not line up cleanly.",
    recommendedAction: discrepancy.suggestedAction,
    risk: `Expected ${formatMoney(
      discrepancy.expectedAmountCents,
      discrepancy.currency,
    )}, actual ${formatMoney(discrepancy.actualAmountCents, discrepancy.currency)}.`,
  };
}

function buildPrompt(discrepancy: DiscrepancyForExplain) {
  return [
    "Explain this revenue reconciliation discrepancy in plain business language.",
    "Use only the facts provided. Do not decide whether records match; the deterministic system already did that.",
    "Keep the explanation concise and operational.",
    "",
    `Discrepancy type: ${discrepancy.type}`,
    `Severity: ${discrepancy.severity}`,
    `Summary: ${discrepancy.summary}`,
    `Suggested action: ${discrepancy.suggestedAction}`,
    `Expected amount: ${formatMoney(discrepancy.expectedAmountCents, discrepancy.currency)}`,
    `Actual amount: ${formatMoney(discrepancy.actualAmountCents, discrepancy.currency)}`,
    `Difference amount cents: ${discrepancy.differenceAmountCents ?? "not available"}`,
    "",
    `Order: ${JSON.stringify(discrepancy.order)}`,
    `Payment: ${JSON.stringify(discrepancy.payment)}`,
  ].join("\n");
}

export async function explainDiscrepancy(userId: string, discrepancyId: string) {
  const discrepancy = await getDiscrepancyForExplain(userId, discrepancyId);

  if (!discrepancy) {
    return null;
  }

  const fallback = fallbackExplanation(discrepancy);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { explanation: fallback, source: "fallback" as const };
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      input: buildPrompt(discrepancy),
      text: {
        format: {
          type: "json_schema",
          name: "discrepancy_explanation",
          strict: true,
          schema: explanationSchema,
        },
      },
    });
    const parsed = JSON.parse(response.output_text);

    if (!isExplanation(parsed)) {
      return { explanation: fallback, source: "fallback" as const };
    }

    return { explanation: parsed, source: "llm" as const };
  } catch {
    return { explanation: fallback, source: "fallback" as const };
  }
}
