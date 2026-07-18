"use client";

import { useState } from "react";
import { DiscrepancyType, Severity } from "@prisma/client";

type FilterFormProps = {
  batchId: string;
  search?: string;
  type?: string;
  severity?: string;
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function FilterForm({ batchId, search, type, severity }: FilterFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <>
      {isLoading ? (
        <div className="full-page-loader" role="status" aria-live="assertive">
          <div className="loader-ring" />
          <p>Applying filters...</p>
        </div>
      ) : null}

      <form className="filter-form" action="/dashboard" onSubmit={() => setIsLoading(true)}>
        <input type="hidden" name="batchId" value={batchId} />
        <label>
          Search
          <input name="search" defaultValue={search ?? ""} placeholder="Order, transaction, email" />
        </label>
        <label>
          Type
          <select name="type" defaultValue={type ?? ""}>
            <option value="">All types</option>
            {Object.values(DiscrepancyType).map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select name="severity" defaultValue={severity ?? ""}>
            <option value="">All severities</option>
            {Object.values(Severity).map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>
    </>
  );
}
