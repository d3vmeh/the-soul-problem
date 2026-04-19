# The Soul Problem — EQ Apologies Data Collection

Expert-labeled benchmark of LLM responses to apology-writing prompts.

## Quickstart

1. `cp .env.example .env.local` and fill in Supabase + Anthropic keys
2. Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor
3. `npm install`
4. `npm run seed` — populates scenarios, screener, and model responses (one-time, ~80 Claude calls)
5. Insert a test expert in Supabase: `insert into experts (invite_token) values ('test-token-abc');`
6. `npm run dev` → visit `/invite/test-token-abc`

## Verify setup

`npx tsx scripts/verify-supabase.ts` prints env + schema status.

## Routes

| Path | Purpose |
| --- | --- |
| `/invite/[token]` | Expert consent |
| `/onboarding` | Name + background |
| `/screener` | EQ-Bench intensity test (5 items, MAD-graded) |
| `/project` | Labeling landing — shows assigned scenarios + progress |
| `/project/scenario/[i]` | Per-scenario labeling (blinded A–D, 3-dim Likert) |
| `/done` | Completion |
| `/admin` | Dashboard + export (basic auth via `ADMIN_PASSWORD`) |
| `/admin/export.jsonl` | Full dataset download |

## Exporting data

Visit `/admin/export.jsonl` authenticated as admin (any username, password = `ADMIN_PASSWORD`). One JSON object per (expert, response) row.

## Assignment model

Each scenario targets 3 graders. When an expert passes the screener, they're assigned the 10 scenarios with the fewest current graders (tie-broken by scenario id). This naturally balances coverage as experts arrive.

## Rubric

Each response is rated on three 1-5 Likert dimensions:

- **Accountability** — takes responsibility without deflection or JADE
- **Specificity** — names the actual transgression and its impact
- **Warmth** — honest emotional register; not robotic or saccharine

Plus optional free-text: "What would make this apology better?"

## Ethics

- Model identity is blinded per expert per scenario
- Explicit consent before labeling; name field stripped from public export
- Rubric encodes one Western-therapeutic model of "good apology" — documented as a limitation
- RLS enabled on every table; only service_role (server-side) can read/write

## Scripts

- `npm run dev` / `build` / `start` — standard Next
- `npm test` — vitest (12 tests covering scoring, blinding, assignments, export)
- `npm run seed` — scenarios + screener + responses
- `npx tsx scripts/verify-supabase.ts` — env + schema check

## Stack

Next.js 16 App Router · TypeScript · Tailwind · Supabase Postgres · @supabase/supabase-js · zod · @anthropic-ai/sdk · vitest · Vercel
