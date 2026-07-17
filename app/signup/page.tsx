import Link from "next/link";

const errors: Record<string, string> = {
  email: "Enter a valid email address.",
  password: "Password must be at least 8 characters.",
  exists: "An account already exists for that email.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const error = (await searchParams)?.error;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Create account</p>
        <h1>Sign up</h1>
        {error ? <p className="form-error">{errors[error] ?? errors.email}</p> : null}
        <form action="/api/auth/signup" method="post" className="auth-form">
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
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button type="submit">Create account</button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
