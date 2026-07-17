import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

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
        </div>
      </header>
      <section className="empty-state">
        <h2>Upload flow comes next</h2>
        <p>This protected page is ready for the import module.</p>
      </section>
    </main>
  );
}
