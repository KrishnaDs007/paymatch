"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BatchItem = {
  id: string;
  name: string;
  createdAt: string | Date;
  orderCount: number;
  paymentCount: number;
  discrepancyCount: number;
};

type BatchListProps = {
  batches: BatchItem[];
  activeBatchId: string;
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function BatchList({ batches, activeBatchId }: BatchListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  async function deleteBatch(batchId: string) {
    const batch = batches.find((item) => item.id === batchId);
    const shouldDelete = window.confirm(
      `Are you sure you want to delete "${batch?.name ?? "this import batch"}"? This will also remove its orders, payments, and discrepancies.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(batchId);
    setError("");

    try {
      const response = await fetch("/api/batches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not delete this batch.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete this batch.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="batch-panel">
      {deletingId ? (
        <div className="full-page-loader" role="status" aria-live="assertive">
          <div className="loader-ring" />
          <p>Deleting import batch...</p>
        </div>
      ) : null}

      <div className="section-heading table-heading">
        <div>
          <h2>Import batches</h2>
          <p>History from previous comparisons. Delete a batch to remove its stored rows.</p>
        </div>
        <Link href="/import" className="secondary-button">
          New import
        </Link>
      </div>

      {error ? <p className="mini-error">{error}</p> : null}

      <div className="batch-list">
        {batches.map((batch) => (
          <article className={batch.id === activeBatchId ? "batch-item active" : "batch-item"} key={batch.id}>
            <div>
              <strong>{batch.name}</strong>
              <span>{formatDate(batch.createdAt)}</span>
            </div>
            <div className="batch-counts">
              <span>{batch.orderCount} orders</span>
              <span>{batch.paymentCount} payments</span>
              <span>{batch.discrepancyCount} issues</span>
            </div>
            <div className="batch-actions">
              {batch.id === activeBatchId ? (
                <span className="current-batch">Selected</span>
              ) : (
                <Link href={`/dashboard?batchId=${batch.id}`}>View</Link>
              )}
              <button
                type="button"
                className="inline-button danger"
                onClick={() => deleteBatch(batch.id)}
                disabled={Boolean(deletingId)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
