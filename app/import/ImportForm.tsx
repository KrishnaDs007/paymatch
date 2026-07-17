"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ImportStep = "idle" | "importing" | "reconciling" | "done";

type ImportResponse = {
  batchId?: string;
  orderCount?: number;
  paymentCount?: number;
  error?: string;
};

type ReconcileResponse = {
  discrepancyCount?: number;
  error?: string;
};

function getErrorMessage(data: ImportResponse | ReconcileResponse, fallback: string) {
  return data.error || fallback;
}

export function ImportForm() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    batchId: string;
    orderCount: number;
    paymentCount: number;
    discrepancyCount: number;
  } | null>(null);

  const isWorking = step === "importing" || step === "reconciling";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setStep("importing");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const importResponse = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const importData = (await importResponse.json()) as ImportResponse;

      if (!importResponse.ok || !importData.batchId) {
        throw new Error(getErrorMessage(importData, "Import failed."));
      }

      setStep("reconciling");

      const reconcileResponse = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: importData.batchId }),
      });
      const reconcileData = (await reconcileResponse.json()) as ReconcileResponse;

      if (!reconcileResponse.ok) {
        throw new Error(getErrorMessage(reconcileData, "Reconciliation failed."));
      }

      const finalResult = {
        batchId: importData.batchId,
        orderCount: importData.orderCount ?? 0,
        paymentCount: importData.paymentCount ?? 0,
        discrepancyCount: reconcileData.discrepancyCount ?? 0,
      };

      setResult(finalResult);
      setStep("done");
      router.push(`/dashboard?batchId=${finalResult.batchId}`);
    } catch (caughtError) {
      setStep("idle");
      setError(caughtError instanceof Error ? caughtError.message : "Import failed.");
    }
  }

  return (
    <section className="tool-panel">
      <form className="upload-form" onSubmit={handleSubmit}>
        <label>
          Batch name
          <input
            name="batchName"
            type="text"
            placeholder="July reconciliation"
            disabled={isWorking}
          />
        </label>

        <label>
          Orders CSV
          <input name="orders" type="file" accept=".csv,text/csv" required disabled={isWorking} />
        </label>

        <label>
          Payments CSV
          <input name="payments" type="file" accept=".csv,text/csv" required disabled={isWorking} />
        </label>

        <button type="submit" disabled={isWorking}>
          {step === "importing"
            ? "Importing..."
            : step === "reconciling"
              ? "Reconciling..."
              : "Import and reconcile"}
        </button>
      </form>

      {error ? <p className="form-error">{error}</p> : null}

      {isWorking ? (
        <div className="status-box">
          <strong>{step === "importing" ? "Importing CSV rows" : "Running reconciliation"}</strong>
          <p>
            {step === "importing"
              ? "Validating files and storing rows under your account."
              : "Comparing orders with payments and saving discrepancies."}
          </p>
        </div>
      ) : null}

      {result ? (
        <div className="status-box">
          <strong>Import complete</strong>
          <p>
            Imported {result.orderCount} orders and {result.paymentCount} payments. Found{" "}
            {result.discrepancyCount} discrepancies.
          </p>
        </div>
      ) : null}
    </section>
  );
}
