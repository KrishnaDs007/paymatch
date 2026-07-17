import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">Import</p>
          <h1>CSV import</h1>
          <p className="muted">Signed in as {user.email}</p>
        </div>
        <nav className="app-nav">
          <a href="/dashboard">Dashboard</a>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="secondary-button">
              Log out
            </button>
          </form>
        </nav>
      </header>
      <ImportForm />
    </main>
  );
}
