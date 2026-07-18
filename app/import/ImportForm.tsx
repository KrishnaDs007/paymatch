"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
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

export function ImportForm({
  currentBatchCount,
  maxImportBatches,
}: {
  currentBatchCount: number;
  maxImportBatches: number;
}) {
  const router = useRouter();
  const ordersInputRef = useRef<HTMLInputElement | null>(null);
  const paymentsInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<ImportStep>("idle");
  const [batchName, setBatchName] = useState("");
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [paymentsFile, setPaymentsFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    batchId: string;
    orderCount: number;
    paymentCount: number;
    discrepancyCount: number;
  } | null>(null);

  const isWorking = step === "importing" || step === "reconciling";
  const isAtLimit = currentBatchCount >= maxImportBatches;
  const canSubmit = Boolean(batchName.trim() && ordersFile && paymentsFile) && !isWorking && !isAtLimit;

  function selectFile(event: ChangeEvent<HTMLInputElement>, type: "orders" | "payments") {
    const file = event.target.files?.[0] ?? null;

    if (type === "orders") {
      setOrdersFile(file);
    } else {
      setPaymentsFile(file);
    }
  }

  function clearFile(type: "orders" | "payments") {
    if (type === "orders") {
      setOrdersFile(null);

      if (ordersInputRef.current) {
        ordersInputRef.current.value = "";
      }
    } else {
      setPaymentsFile(null);

      if (paymentsInputRef.current) {
        paymentsInputRef.current.value = "";
      }
    }
  }

  function clearSelectedFiles() {
    setOrdersFile(null);
    setPaymentsFile(null);

    if (ordersInputRef.current) {
      ordersInputRef.current.value = "";
    }

    if (paymentsInputRef.current) {
      paymentsInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.reportValidity() || !canSubmit) {
      return;
    }

    setError("");
    setResult(null);
    setStep("importing");

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
      clearSelectedFiles();
      router.push(`/dashboard?batchId=${finalResult.batchId}`);
    } catch (caughtError) {
      setStep("idle");
      clearSelectedFiles();
      setError(caughtError instanceof Error ? caughtError.message : "Import failed.");
    }
  }

  return (
    <section className="tool-panel">
      {isWorking ? (
        <div className="full-page-loader" role="status" aria-live="assertive">
          <div className="loader-ring" />
          <p>{step === "importing" ? "Importing CSV rows..." : "Running reconciliation..."}</p>
        </div>
      ) : null}

      <div className="upload-intro">
        <h2>Upload files</h2>
        <p>
          Use CSV files only. The orders file must contain order rows, and the payments file must contain processor transaction rows.
        </p>
        <p>
          History limit: {currentBatchCount} of {maxImportBatches} import batches used.
        </p>
      </div>

      {isAtLimit ? (
        <div className="status-box warning-box">
          <strong>Import history is full</strong>
          <p>Delete an older import batch from history before uploading a new comparison.</p>
        </div>
      ) : null}

      <form className="upload-form" onSubmit={handleSubmit}>
        <label>
          <span className="field-label">
            Batch name
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </span>
          <input
            name="batchName"
            type="text"
            required
            minLength={2}
            maxLength={80}
            placeholder="July reconciliation"
            value={batchName}
            onChange={(event) => setBatchName(event.target.value)}
            disabled={isWorking || isAtLimit}
          />
        </label>

        <div className="upload-grid">
          <label className="file-picker">
            <span className="field-label">
              Orders CSV
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </span>
            <span className="file-help">Accepted type: `.csv`, up to 2 MB.</span>
            <input
              ref={ordersInputRef}
              name="orders"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={isWorking || isAtLimit}
              onChange={(event) => selectFile(event, "orders")}
            />
            {ordersFile ? (
              <span className="file-chip">
                <span>
                  <strong>{ordersFile.name}</strong>
                  {(ordersFile.size / 1024).toFixed(1)} KB selected
                </span>
                <button type="button" onClick={() => clearFile("orders")} disabled={isWorking}>
                  x
                </button>
              </span>
            ) : null}
          </label>

          <label className="file-picker">
            <span className="field-label">
              Payments CSV
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </span>
            <span className="file-help">Accepted type: `.csv`, up to 2 MB.</span>
            <input
              ref={paymentsInputRef}
              name="payments"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={isWorking || isAtLimit}
              onChange={(event) => selectFile(event, "payments")}
            />
            {paymentsFile ? (
              <span className="file-chip">
                <span>
                  <strong>{paymentsFile.name}</strong>
                  {(paymentsFile.size / 1024).toFixed(1)} KB selected
                </span>
                <button type="button" onClick={() => clearFile("payments")} disabled={isWorking}>
                  x
                </button>
              </span>
            ) : null}
          </label>
        </div>

        <button type="submit" disabled={!canSubmit}>
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
