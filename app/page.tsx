import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="welcome-page">
      <section className="welcome-panel">
        <div className="shape shape-large" />
        <div className="shape shape-small" />
        <div className="dot-grid" />
        <div className="welcome-copy">
          <p className="eyebrow light">Revenue reconciliation</p>
          <h1>Welcome to PayMatch</h1>
          <p>Import orders and payments, find mismatches, and focus on the money that needs attention.</p>
        </div>
      </section>

      <section className="welcome-auth">
        <div className="auth-panel">
          <p className="eyebrow">Welcome back</p>
          <h1>Log in</h1>
          <form action="/api/auth/login" method="post" className="auth-form">
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit">Log in</button>
          </form>
          <p className="auth-switch">
            Do not have an account? <a href="/signup">Create account</a>
          </p>
        </div>
      </section>
    </main>
  );
}
