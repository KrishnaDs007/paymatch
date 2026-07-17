export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Revenue reconciliation</p>
        <h1>Find order and payment mismatches before they become losses.</h1>
        <p>
          Import order and payment CSVs, run deterministic matching, and review
          the rows that need attention.
        </p>
        <div className="home-actions">
          <a href="/signup">Sign up</a>
          <a href="/login" className="secondary-link">
            Log in
          </a>
        </div>
      </section>
    </main>
  );
}
