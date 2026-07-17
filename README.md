# PayMatch

PayMatch is a full-stack revenue reconciliation app. A user can sign up, import an orders CSV and a payments CSV, run deterministic reconciliation, review dashboard metrics, drill into discrepancies, and request a plain-language explanation for an individual issue.

## Live Submission

Fill these in after deployment:

- GitHub repository: `[add after deployment]`
- Live app URL: `[add after deployment]`
- Backend URL: same as the live app URL
- Test access: users can sign up, or provide a test account here

## Tech Stack

- Next.js App Router with TypeScript
- PostgreSQL with Prisma
- Credentials auth with bcrypt password hashing
- Signed HTTP-only session cookie
- `csv-parse` for CSV ingestion
- OpenAI Responses API for backend-only explanations

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Fill `.env`:

```bash
DATABASE_URL=
DIRECT_URL=
SESSION_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=
```

`DATABASE_URL` should be the pooled database URL for the running app. `DIRECT_URL` should be the direct database URL for schema sync. `OPENAI_API_KEY` is optional for local testing because the app returns deterministic fallback explanations when the LLM call is unavailable. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

4. Sync the database schema:

```bash
npm run prisma:push
```

5. Start the app:

```bash
npm run dev
```

6. Open the local URL, sign up, import the provided `orders.csv` and `payments.csv`, then review the dashboard.

## Deployment Notes

The app is ready for a single Next.js deployment, for example on Vercel.

Required production environment variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

Prisma client generation runs automatically through `postinstall`. Before the first production test, sync the schema against the hosted database:

```bash
npm run prisma:push
```

For Supabase pooler URLs, the app automatically appends `pgbouncer=true` at runtime when it is missing.

## Architecture

The project is one deployable Next.js app:

- Server pages protect private routes by reading the signed session cookie.
- API routes handle auth, CSV import, reconciliation, dashboard data, and LLM explanations.
- Prisma stores users, import batches, order rows, payment rows, and discrepancy records.
- Dashboard pages read backend-calculated metrics instead of recalculating financial logic in the browser.

Important files:

- `prisma/schema.prisma`: database models and enums.
- `lib/auth.ts`: password hashing, signed session cookie, current-user lookup.
- `lib/import-data.ts`: CSV validation, parsing, normalization, and database insert.
- `lib/reconcile.ts`: deterministic matching and discrepancy creation.
- `lib/dashboard.ts`: metrics, chart data, filters, search, and table rows.
- `lib/explain.ts`: backend-only OpenAI call plus deterministic fallback.

## Reconciliation Logic

Records are matched by normalized references:

- `orders.order_id`
- `payments.order_reference`

Normalization trims whitespace and uppercases the value. Raw values are still stored so format problems can be reported.

Only settled charges count as successful payments:

- `type = charge`
- `status = settled`

The app compares order `net_amount` to payment `amount`, not `net_settled`, because processor fees reduce settlement but do not change what the customer was charged.

Money is stored as integer cents. Amounts match when the absolute difference is at most 1 cent.

Discrepancy types:

- `MISSING_PAYMENT`: completed order has no payment charge.
- `ORPHAN_PAYMENT`: payment references an order not present in the order file.
- `AMOUNT_MISMATCH`: settled charge differs from order net amount beyond tolerance.
- `CURRENCY_MISMATCH`: order and payment currencies differ.
- `DUPLICATE_CHARGE`: more than one settled charge exists for one order.
- `STATUS_MISMATCH`: non-completed order has an unexpected settled charge.
- `REFUND_PRESENT`: refund exists and needs review.
- `REFERENCE_FORMAT_MISMATCH`: normalized references match but raw formats differ.
- `PENDING_OR_FAILED_PAYMENT`: charge exists but is pending or failed.

The engine avoids double-counting pending or failed charges as missing payments. A refunded order with both a settled charge and a refund is treated as expected refunded-order behavior unless another rule is violated.

## Data Findings

For the provided files:

- Orders imported: 185
- Payments imported: 187
- Discrepancies found: 21

Breakdown:

- Missing payments: 4
- Orphan payments: 3
- Amount mismatches: 4
- Currency mismatches: 2
- Duplicate charges: 2
- Status mismatch: 1
- Refund present: 1
- Reference format mismatches: 2
- Pending or failed payments: 2

Business meaning:

- Missing and pending/failed payments indicate orders that may not have collected revenue.
- Orphan payments indicate processor money that cannot be tied back to an order record.
- Duplicate charges may mean customers were charged more than once.
- Currency mismatches can make an apparent amount match unsafe.
- Amount mismatches identify undercharges, overcharges, or rounding/data errors.
- Reference format mismatches are lower financial risk but create operational cleanup work.

## LLM Approach

The LLM is called only from `POST /api/explain`. The frontend sends a discrepancy ID, and the backend verifies that the logged-in user owns that discrepancy before building a prompt.

The prompt contains only deterministic facts already stored by the reconciliation engine: discrepancy type, severity, summary, suggested action, amounts, and linked order/payment context. The model is explicitly told not to decide matches, change discrepancy types, or invent missing data.

The API requests structured JSON with:

- `title`
- `plainLanguageSummary`
- `likelyCause`
- `recommendedAction`
- `risk`

Temperature is set to `0.2` so explanations are consistent and operational rather than creative. The default model is `gpt-4.1-mini`, and it can be changed with `OPENAI_MODEL`.

If the API key is missing, quota is exceeded, the API call fails, or the model returns malformed output, the app returns a deterministic fallback explanation using the stored discrepancy summary and suggested action.

## Auth And Security

- Passwords are hashed with bcrypt.
- Sessions are signed with HMAC SHA-256.
- Session cookies are HTTP-only and use `secure` in production.
- Private pages and API routes check the current user.
- Database queries include `userId` so users only see their own imports and discrepancies.
- Secrets are read from environment variables and are not committed.

## Validation And Error Handling

CSV import validates:

- required files
- `.csv` extension
- supported file type
- non-empty file content
- required columns
- row-level required values
- valid money values

The import accepts a blank `customer_email` and blank order `discount` because the provided data includes that messiness. Blank discount is treated as zero.

## AI Tool Usage

AI coding assistance was used to help plan, implement, and review the project module by module. The reconciliation rules, data findings, and final code paths were verified against the provided CSVs and are explainable from the source.

## Future Improvements

- Add automated tests for each discrepancy type.
- Add downloadable discrepancy reports.
- Add batch history comparison.
- Add admin-safe seed/demo data for reviewers.
- Add pagination controls beyond the current server-side table query.
- Add deployment monitoring and structured logs for failed imports or LLM calls.
