import Link from "next/link";

const errors: Record<string, string> = {
  invalid: "Email or password is incorrect.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const error = (await searchParams)?.error;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Welcome back</p>
        <h1>Log in</h1>
        {error ? <p className="form-error">{errors[error] ?? errors.invalid}</p> : null}
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
          Need an account? <Link href="/signup">Sign up</Link>
        </p>
      </section>
    </main>
  );
}
