import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();

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
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="secondary-button">
            Log out
          </button>
        </form>
      </header>
      <section className="empty-state">
        <h2>Import data next</h2>
        <p>
          Authentication is ready. The next module will add CSV upload and
          database-backed imports.
        </p>
      </section>
    </main>
  );
}
