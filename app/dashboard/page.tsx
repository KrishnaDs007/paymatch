import { redirect } from "next/navigation";
import { AppHeader } from "@/app/AppHeader";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSummary, getDiscrepancyPage, getImportBatches } from "@/lib/dashboard";
import { BatchList } from "./BatchList";
import { ExplainButton } from "./ExplainButton";
import { FilterForm } from "./FilterForm";

function formatMoney(cents: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((cents ?? 0) / 100);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSeverityRank(severity: string) {
  if (severity === "HIGH") {
    return 3;
  }

  if (severity === "MEDIUM") {
    return 2;
  }

  return 1;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    batchId?: string;
    search?: string;
    type?: string;
    severity?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = (await searchParams) ?? {};

  if (!user) {
    redirect("/login");
  }

  const [summary, batches] = await Promise.all([
    getDashboardSummary(user.id, params.batchId),
    getImportBatches(user.id),
  ]);

  if (!summary) {
    return (
      <main className="app-page">
        <AppHeader
          eyebrow="Dashboard"
          title="Revenue review"
          subtitle="No reconciliation batch is available yet."
          user={user}
          activePage="dashboard"
        />
        <section className="empty-state empty-card">
          <p className="eyebrow">No data yet</p>
          <h2>Import orders and payments to build your dashboard</h2>
          <p>
            Upload both CSV files, run reconciliation, and this page will show metrics, risk
            breakdowns, filters, and individual discrepancy rows.
          </p>
          <a href="/import" className="secondary-button">
            Start import
          </a>
        </section>
      </main>
    );
  }

  const query = new URLSearchParams();
  query.set("batchId", summary.batch.id);

  if (params.search) query.set("search", params.search);
  if (params.type) query.set("type", params.type);
  if (params.severity) query.set("severity", params.severity);
  if (params.page) query.set("page", params.page);

  const discrepancyPage = await getDiscrepancyPage(
    user.id,
    `http://dashboard.local/dashboard?${query.toString()}`,
  );
  const maxTypeCount = Math.max(
    1,
    ...summary.breakdownByType.map((item) => item.count),
  );
  const highestRisk = [...summary.breakdownByType].sort(
    (first, second) => second.riskCents - first.riskCents,
  )[0];
  const tableQuery = new URLSearchParams(query);

  tableQuery.delete("page");

  return (
    <main className="app-page">
      <AppHeader
        eyebrow="Dashboard"
        title="Revenue review"
        subtitle={`Batch: ${summary.batch.name}`}
        user={user}
        activePage="dashboard"
      />

      <BatchList batches={batches} activeBatchId={summary.batch.id} />

      <section className="metric-grid" aria-label="Dashboard metrics">
        <div className="metric-card">
          <span>Total orders</span>
          <strong>{summary.metrics.totalOrders}</strong>
        </div>
        <div className="metric-card">
          <span>Total payments</span>
          <strong>{summary.metrics.totalPayments}</strong>
        </div>
        <div className="metric-card">
          <span>Reconciled value</span>
          <strong>{formatMoney(summary.metrics.reconciledValueCents)}</strong>
        </div>
        <div className="metric-card risk">
          <span>Money at risk</span>
          <strong>{formatMoney(summary.metrics.moneyAtRiskCents)}</strong>
        </div>
        <div className="metric-card">
          <span>Completed order value</span>
          <strong>{formatMoney(summary.metrics.completedOrderValueCents)}</strong>
        </div>
        <div className="metric-card">
          <span>Discrepancies</span>
          <strong>{summary.metrics.discrepancyCount}</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="chart-panel">
          <div className="section-heading">
            <h2>Discrepancies by type</h2>
            <p>{highestRisk ? `${titleCase(highestRisk.type)} carries the highest risk.` : "No issues found."}</p>
          </div>
          <div className="bar-list">
            {summary.breakdownByType.map((item) => (
              <div
                className="bar-row"
                key={item.type}
                title={`${titleCase(item.type)}: ${item.count} discrepancy rows, ${formatMoney(item.riskCents)} at risk.`}
              >
                <div className="bar-label">
                  <span>{titleCase(item.type)}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.max(6, (item.count / maxTypeCount) * 100)}%` }}
                  />
                </div>
                <span className="bar-risk">
                  {formatMoney(item.riskCents)}
                  <small>
                    {item.count} of {summary.metrics.discrepancyCount}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-panel">
          <div className="section-heading">
            <h2>Severity</h2>
            <p>High severity rows should be reviewed first.</p>
          </div>
          <div className="severity-list">
            {summary.breakdownBySeverity
              .sort((first, second) => getSeverityRank(second.severity) - getSeverityRank(first.severity))
              .map((item) => (
                <div className={`severity-pill ${item.severity.toLowerCase()}`} key={item.severity}>
                  <span>{titleCase(item.severity)}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="table-panel">
        <div className="section-heading table-heading">
          <div>
            <h2>Discrepancy rows</h2>
            <p>
              Showing {discrepancyPage?.rows.length ?? 0} of {discrepancyPage?.total ?? 0} rows.
            </p>
          </div>
          <a href={`/dashboard?batchId=${summary.batch.id}`} className="text-link">
            Clear filters
          </a>
        </div>

        <FilterForm
          batchId={summary.batch.id}
          search={params.search}
          type={params.type}
          severity={params.severity}
        />

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Severity</th>
                <th>Order</th>
                <th>Payment</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Risk</th>
                <th>Action</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {discrepancyPage?.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{titleCase(row.type)}</strong>
                    <span>{row.summary}</span>
                  </td>
                  <td>
                    <span className={`severity-tag ${row.severity.toLowerCase()}`}>
                      {titleCase(row.severity)}
                    </span>
                  </td>
                  <td>
                    <strong>{row.orderId ?? "No order"}</strong>
                    <span>{row.customerEmail || row.orderStatus || ""}</span>
                  </td>
                  <td>
                    <strong>{row.transactionRef ?? "No payment"}</strong>
                    <span>{row.paymentReference || row.paymentStatus || ""}</span>
                  </td>
                  <td>{formatMoney(row.expectedAmountCents, row.currency ?? "USD")}</td>
                  <td>{formatMoney(row.actualAmountCents, row.currency ?? "USD")}</td>
                  <td>{formatMoney(row.riskCents, row.currency ?? "USD")}</td>
                  <td>{row.suggestedAction}</td>
                  <td>
                    <ExplainButton discrepancyId={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {discrepancyPage && discrepancyPage.totalPages > 1 ? (
          <div className="pagination">
            <a
              href={`/dashboard?${new URLSearchParams({
                ...Object.fromEntries(tableQuery),
                page: String(Math.max(1, discrepancyPage.page - 1)),
              })}`}
            >
              Previous
            </a>
            <span>
              Page {discrepancyPage.page} of {discrepancyPage.totalPages}
            </span>
            <a
              href={`/dashboard?${new URLSearchParams({
                ...Object.fromEntries(tableQuery),
                page: String(Math.min(discrepancyPage.totalPages, discrepancyPage.page + 1)),
              })}`}
            >
              Next
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
