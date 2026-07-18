"use client";

import { useState } from "react";

type Explanation = {
  title: string;
  plainLanguageSummary: string;
  likelyCause: string;
  recommendedAction: string;
  risk: string;
};

type ExplainResponse = {
  explanation?: Explanation;
  source?: "llm" | "fallback";
  error?: string;
};

export function ExplainButton({ discrepancyId }: { discrepancyId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [source, setSource] = useState<"llm" | "fallback" | null>(null);

  async function explain() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discrepancyId }),
      });
      const data = (await response.json()) as ExplainResponse;

      if (!response.ok || !data.explanation) {
        throw new Error(data.error || "Could not explain this discrepancy.");
      }

      setExplanation(data.explanation);
      setSource(data.source ?? "fallback");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Could not explain this discrepancy.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="explain-box">
      {isLoading ? (
        <div className="full-page-loader" role="status" aria-live="assertive">
          <div className="loader-ring" />
          <p>Preparing explanation...</p>
        </div>
      ) : null}

      <button type="button" className="inline-button" onClick={explain} disabled={isLoading}>
        {isLoading ? "Explaining..." : "Explain"}
      </button>

      {error ? <p className="mini-error">{error}</p> : null}

      {explanation ? (
        <div className="explanation">
          <strong>{explanation.title}</strong>
          <p>{explanation.plainLanguageSummary}</p>
          <p>
            <span>Likely cause:</span> {explanation.likelyCause}
          </p>
          <p>
            <span>Next step:</span> {explanation.recommendedAction}
          </p>
          <p>
            <span>Risk:</span> {explanation.risk}
          </p>
          {source === "fallback" ? <em>Fallback explanation shown.</em> : null}
        </div>
      ) : null}
    </div>
  );
}
