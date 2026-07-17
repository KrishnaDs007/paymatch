import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ batchId?: string }>;
}) {
  const user = await getCurrentUser();
  const batchId = (await searchParams)?.batchId;

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Revenue review</h1>
          <p className="muted">Signed in as {user.email}</p>
        </div>
        <nav className="app-nav">
          <a href="/import">Import</a>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="secondary-button">
              Log out
            </button>
          </form>
        </nav>
      </header>
      <section className="empty-state">
        <h2>{batchId ? "Import ready for dashboard" : "Import data first"}</h2>
        <p>
          {batchId
            ? "The imported batch has been reconciled. The next module will render metrics, charts, and discrepancy rows here."
            : "Upload the orders and payments CSVs to create a reconciled batch."}
        </p>
        <a href="/import" className="text-link">
          Go to import
        </a>
      </section>
    </main>
  );
}
