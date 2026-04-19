# EQ Apologies — Data Collection Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed Next.js + Supabase web platform where AfterQuery experts land on an invite link, pass an EQ screener, and each label an auto-balanced 10-scenario slice of 20 LLM-generated apology scenarios × 4 model responses on a 3-dimension Likert rubric (targeting 3 graders per scenario), with JSONL export from the admin panel.

**Architecture:** Next.js 16 App Router on Vercel. Supabase Postgres for persistence. Invite-token-in-URL identifies experts (no passwords). Model responses generated once at seed time and frozen in the DB. Screener grades via deterministic mean-absolute-deviation against EQ-Bench reference intensities. Admin dashboard gated by basic-auth env var.

**Tech Stack:** Next.js 16, TypeScript, Tailwind, Supabase (Postgres), @supabase/supabase-js, zod, Anthropic SDK (seed-time only), Vercel.

**Repo layout convention:** everything in this plan lives under `the-soul-problem/` at the workspace root. All commands assume the working directory is `the-soul-problem/` unless stated otherwise.

**Hackathon pragmatism:** TDD only pure logic (MAD scoring, JSONL export, blinding permutations). UI pages are verified manually in a browser. Each task ends in a commit.

---

## File structure (inside `the-soul-problem/`)

```
the-soul-problem/
├── .gitignore                                   # already present
├── .env.example
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── vercel.ts
├── vitest.config.ts
├── middleware.ts
│
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx
│   ├── invite/[token]/page.tsx
│   ├── onboarding/page.tsx
│   ├── screener/page.tsx
│   ├── screener/form.tsx
│   ├── screener/thanks/page.tsx
│   ├── project/page.tsx
│   ├── project/scenario/[i]/page.tsx
│   ├── project/scenario/[i]/form.tsx
│   ├── done/page.tsx
│   ├── admin/page.tsx
│   ├── admin/export.jsonl/route.ts
│   └── api/
│       ├── consent/route.ts
│       ├── onboarding/route.ts
│       ├── screener/submit/route.ts
│       └── label/route.ts
│
├── lib/
│   ├── supabase.ts
│   ├── session.ts
│   ├── admin-auth.ts
│   ├── scoring.ts
│   ├── blinding.ts
│   ├── assignments.ts
│   ├── export.ts
│   └── types.ts
│
├── tests/
│   ├── scoring.test.ts
│   ├── blinding.test.ts
│   ├── assignments.test.ts
│   └── export.test.ts
│
├── supabase/
│   └── migrations/
│       └── 0001_init.sql
│
├── scripts/
│   ├── generate-scenarios.ts                    # calls Claude, writes data/scenarios.json
│   ├── seed-scenarios.ts                        # reads data/scenarios.json → DB
│   ├── seed-responses.ts
│   ├── seed-screener.ts
│   └── run-all-seeds.ts
│
├── data/
│   ├── scenarios.json                           # generated; committed for reproducibility
│   ├── scenarios-prompt.txt                     # the LLM prompt used to generate them
│   ├── screener.json
│   └── responses.json                           # written by seed-responses (optional)
│
└── docs/
    └── superpowers/
        ├── specs/2026-04-19-eq-apologies-data-collection-platform-design.md
        └── plans/2026-04-19-eq-apologies-data-collection-platform.md
```

---

## Task 1: Scaffold Next.js in `the-soul-problem/`

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Confirm we are in the repo root**

```bash
cd the-soul-problem
git status
```

Expected: clean working tree except for the untracked `docs/` we just added. If `docs/` is untracked, stage and commit it now:

```bash
git add docs/
git commit -m "docs: add spec and plan"
```

- [ ] **Step 2: Scaffold Next.js in place (non-interactive)**

```bash
npx --yes create-next-app@latest . \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias="@/*" --use-npm --turbopack --yes
```

This may prompt to overwrite `.gitignore` — answer **no** (keep ours). If the CLI overwrites it anyway, restore: `git checkout -- .gitignore`.

- [ ] **Step 3: Install runtime and dev deps**

```bash
npm install @supabase/supabase-js zod @anthropic-ai/sdk dotenv
npm install -D @types/node tsx vitest
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "tsx scripts/run-all-seeds.ts",
    "seed:scenarios": "tsx scripts/seed-scenarios.ts",
    "seed:screener": "tsx scripts/seed-screener.ts",
    "seed:responses": "tsx scripts/seed-responses.ts"
  }
}
```

- [ ] **Step 6: Replace `app/page.tsx`**

```tsx
export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-semibold">The Soul Problem</h1>
        <p className="text-neutral-600">
          An expert-labeled benchmark of how LLMs write apologies on behalf of people.
          If you have an invite link, you can open it now.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify dev server boots**

```bash
npm run dev
```

Expected: `Ready` on http://localhost:3000 showing the landing headline. Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js 16 + Tailwind + Vitest"
```

---

## Task 2: Supabase schema + server client

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `lib/supabase.ts`, `lib/types.ts`, `.env.example`

- [ ] **Step 1: Provision Supabase**

Sign up at https://supabase.com and create a new project (or provision via `vercel integrations install supabase` if the Vercel CLI is installed). Copy URL, anon key, and service role key.

- [ ] **Step 2: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Create `.env.local` locally (NOT committed)**

```bash
cp .env.example .env.local
# Paste real values into .env.local. The .gitignore already excludes it.
```

- [ ] **Step 4: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:

```sql
create extension if not exists "uuid-ossp";

create table experts (
  id uuid primary key default uuid_generate_v4(),
  invite_token text unique not null,
  name text,
  background text,
  consent_at timestamptz,
  screener_passed boolean,
  screener_mad real,
  created_at timestamptz default now()
);

create table scenarios (
  id serial primary key,
  prompt text not null,
  metadata jsonb default '{}'::jsonb
);

create table responses (
  id serial primary key,
  scenario_id int references scenarios(id) on delete cascade,
  model text not null,
  text text not null
);

create table labels (
  id serial primary key,
  expert_id uuid references experts(id) on delete cascade,
  response_id int references responses(id) on delete cascade,
  accountability int check (accountability between 1 and 5),
  specificity int check (specificity between 1 and 5),
  warmth int check (warmth between 1 and 5),
  reasoning text,
  submitted_at timestamptz default now(),
  unique (expert_id, response_id)
);

create table screener_questions (
  id serial primary key,
  prompt text not null,
  emotions jsonb not null,
  reference_intensities jsonb not null
);

create table screener_answers (
  id serial primary key,
  expert_id uuid references experts(id) on delete cascade,
  question_id int references screener_questions(id) on delete cascade,
  predicted_intensities jsonb not null,
  abs_deviation real not null,
  unique (expert_id, question_id)
);

create table assignments (
  id serial primary key,
  expert_id uuid references experts(id) on delete cascade,
  scenario_id int references scenarios(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (expert_id, scenario_id)
);

create index labels_expert_idx on labels(expert_id);
create index labels_response_idx on labels(response_id);
create index responses_scenario_idx on responses(scenario_id);
create index assignments_expert_idx on assignments(expert_id);
create index assignments_scenario_idx on assignments(scenario_id);
```

- [ ] **Step 5: Apply migration**

In Supabase dashboard → SQL editor → paste `0001_init.sql` → Run. Verify all six tables exist in Table Editor.

- [ ] **Step 6: Server client**

Create `lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 7: Shared TS types**

Create `lib/types.ts`:

```ts
export type Expert = {
  id: string;
  invite_token: string;
  name: string | null;
  background: string | null;
  consent_at: string | null;
  screener_passed: boolean | null;
  screener_mad: number | null;
};

export type Scenario = {
  id: number;
  prompt: string;
  metadata: Record<string, unknown>;
};

export type ModelResponse = {
  id: number;
  scenario_id: number;
  model: string;
  text: string;
};

export type ScreenerQuestion = {
  id: number;
  prompt: string;
  emotions: string[];
  reference_intensities: number[];
};

export type LabelScores = {
  accountability: number;
  specificity: number;
  warmth: number;
};
```

- [ ] **Step 8: Commit**

```bash
git add supabase/ lib/ .env.example
git commit -m "feat: supabase schema, server client, shared types"
```

---

## Task 3: Scoring logic (TDD)

**Files:**
- Create: `lib/scoring.ts`, `tests/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { meanAbsoluteDeviation, screenerPassed } from '@/lib/scoring';

describe('meanAbsoluteDeviation', () => {
  it('returns 0 for identical vectors', () => {
    expect(meanAbsoluteDeviation([3, 5, 7], [3, 5, 7])).toBe(0);
  });

  it('returns the mean of absolute element-wise differences', () => {
    expect(meanAbsoluteDeviation([1, 2, 3], [4, 2, 6])).toBeCloseTo((3 + 0 + 3) / 3);
  });

  it('throws if lengths differ', () => {
    expect(() => meanAbsoluteDeviation([1, 2], [1, 2, 3])).toThrow();
  });
});

describe('screenerPassed', () => {
  it('passes at or below threshold', () => {
    expect(screenerPassed(2.9, 3.0)).toBe(true);
    expect(screenerPassed(3.0, 3.0)).toBe(true);
  });

  it('fails above threshold', () => {
    expect(screenerPassed(3.1, 3.0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test
```

Expected: FAIL — `@/lib/scoring` not found.

- [ ] **Step 3: Implement**

Create `lib/scoring.ts`:

```ts
export function meanAbsoluteDeviation(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`length mismatch: ${a.length} vs ${b.length}`);
  if (a.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

export function screenerPassed(mad: number, threshold: number): boolean {
  return mad <= threshold;
}

export const SCREENER_MAD_THRESHOLD = 3.0;
```

- [ ] **Step 4: Run tests to confirm green**

```bash
npm test
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts tests/scoring.test.ts
git commit -m "feat(scoring): MAD computation and pass threshold"
```

---

## Task 4: Deterministic response blinding (TDD)

**Files:**
- Create: `lib/blinding.ts`, `tests/blinding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/blinding.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { blindingOrder } from '@/lib/blinding';

describe('blindingOrder', () => {
  it('returns a permutation of the input', () => {
    const ids = [10, 20, 30, 40];
    const out = blindingOrder(ids, 'expert-uuid', 1);
    expect([...out].sort((a, b) => a - b)).toEqual(ids);
  });

  it('is deterministic for the same (expert, scenario)', () => {
    const ids = [10, 20, 30, 40];
    expect(blindingOrder(ids, 'e1', 1)).toEqual(blindingOrder(ids, 'e1', 1));
  });

  it('varies across experts', () => {
    const ids = [10, 20, 30, 40];
    expect(blindingOrder(ids, 'e1', 1)).not.toEqual(blindingOrder(ids, 'e2', 1));
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/blinding.ts`:

```ts
import { createHash } from 'node:crypto';

function seedFrom(expertId: string, scenarioId: number): number {
  const h = createHash('sha256').update(`${expertId}:${scenarioId}`).digest();
  return h.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function blindingOrder<T>(items: T[], expertId: string, scenarioId: number): T[] {
  const rand = mulberry32(seedFrom(expertId, scenarioId));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
```

- [ ] **Step 4: Run to confirm green**

```bash
npm test
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/blinding.ts tests/blinding.test.ts
git commit -m "feat(blinding): deterministic per-expert response shuffle"
```

---

## Task 5: Seed data — scenarios (LLM-generated), screener, responses

**Files:**
- Create: `data/scenarios-prompt.txt`, `data/scenarios.json` (generated), `data/screener.json`, `scripts/generate-scenarios.ts`, `scripts/seed-scenarios.ts`, `scripts/seed-screener.ts`, `scripts/seed-responses.ts`, `scripts/run-all-seeds.ts`

- [ ] **Step 1: Commit the scenario-generation prompt**

Create `data/scenarios-prompt.txt` (committed for reproducibility):

```
Generate exactly 20 diverse scenarios in which a user is asking an AI assistant to help them write an apology.

Each scenario must be a first-person message from the user to the assistant. The message should:
- State what the user did wrong (the transgression)
- Identify who they need to apologize to (the relationship)
- Include enough context to make the emotional stakes clear
- End with an explicit request for help drafting an apology

Vary across all of these axes; do not cluster:
- Relationship: partner, spouse, parent, adult child, sibling, close friend, casual friend, coworker, manager, direct report, neighbor, someone they dated briefly, estranged family member
- Transgression: betrayal, neglect, harm (verbal or physical), mistake, boundary violation, dishonesty, broken promise, public embarrassment
- Severity: low (easily repaired), medium (requires real repair), high (possibly unforgivable)
- Tone: defensive user, ashamed user, minimizing user, distraught user, matter-of-fact user
- Stakes: low-stakes text to close friend vs. written letter to estranged parent vs. workplace script

Return strict JSON only, no preamble, no code fence:

[
  {
    "prompt": "<the user's first-person message>",
    "metadata": {
      "relationship": "<one of the relationship values>",
      "transgression": "<one of the transgression values>",
      "severity": "low|medium|high"
    }
  }
]

Length: each prompt 2-5 sentences. No duplicates. No moralizing in the metadata.
```

- [ ] **Step 2: Write `scripts/generate-scenarios.ts`**

```ts
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

const Scenario = z.object({
  prompt: z.string().min(40),
  metadata: z.object({
    relationship: z.string(),
    transgression: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  }),
});
const Scenarios = z.array(Scenario).length(20);

async function main() {
  const prompt = readFileSync('data/scenarios-prompt.txt', 'utf8');
  const anthropic = new Anthropic();

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    try {
      const json = JSON.parse(text);
      const parsed = Scenarios.parse(json);
      writeFileSync('data/scenarios.json', JSON.stringify(parsed, null, 2) + '\n');
      console.log(`wrote 20 scenarios (attempt ${attempt})`);
      return;
    } catch (e) {
      console.warn(`attempt ${attempt} failed:`, (e as Error).message);
    }
  }
  throw new Error('gave up after 3 attempts');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run it**

```bash
npx tsx scripts/generate-scenarios.ts
```

Expected: `data/scenarios.json` exists with 20 validated scenarios.

- [ ] **Step 4: Spot-check `data/scenarios.json`**

Open the file. Verify:
- 20 entries, distinct transgressions
- No two scenarios describe near-identical situations
- Every `metadata.severity` is `low`, `medium`, or `high`

If quality is poor (repetitive, off-tone), rerun Step 3. If persistent problems, tighten `data/scenarios-prompt.txt` and iterate.

Commit the prompt + generated output now so the seed step is reproducible:

```bash
git add data/scenarios-prompt.txt data/scenarios.json scripts/generate-scenarios.ts
git commit -m "feat(seed): LLM-generated 20 apology scenarios"
```

- [ ] **Step 5: Build `data/screener.json` from EQ-Bench**

Five entries sampled from https://huggingface.co/datasets/pbevan11/EQ-Bench validation split. For each EQ-Bench row, extract the `prompt` string and parse `reference_answer` (JSON) to get four `emotionN` names and four `emotionN_score` integers.

Create `data/screener.json`:

```json
[
  {
    "prompt": "<paste EQ-Bench dialogue text here>",
    "emotions": ["Remorseful", "Indifferent", "Affectionate", "Annoyed"],
    "reference_intensities": [2, 3, 0, 5]
  }
]
```

Repeat for five entries. Use diverse scenarios (conflict, work, family, romance, reconciliation). The fastest way to extract: Python one-liner in a scratch REPL:

```python
from datasets import load_dataset
import json
ds = load_dataset('pbevan11/EQ-Bench')['validation']
out = []
for row in ds.select(range(5)):
    ref = json.loads(row['reference_answer'])
    out.append({
        "prompt": row['prompt'],
        "emotions": [ref['emotion1'], ref['emotion2'], ref['emotion3'], ref['emotion4']],
        "reference_intensities": [ref['emotion1_score'], ref['emotion2_score'], ref['emotion3_score'], ref['emotion4_score']],
    })
print(json.dumps(out, indent=2))
```

Paste the output into `data/screener.json`.

- [ ] **Step 6: Scenarios seed script (inserts generated JSON into DB)**

Create `scripts/seed-scenarios.ts`:

```ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';

async function main() {
  const scenarios = JSON.parse(readFileSync('data/scenarios.json', 'utf8'));
  const db = supabaseService();
  await db.from('scenarios').delete().gte('id', 0);
  const { error } = await db.from('scenarios').insert(scenarios);
  if (error) throw error;
  console.log(`seeded ${scenarios.length} scenarios`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: Screener seed script**

Create `scripts/seed-screener.ts`:

```ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';

async function main() {
  const items = JSON.parse(readFileSync('data/screener.json', 'utf8'));
  const db = supabaseService();
  await db.from('screener_questions').delete().gte('id', 0);
  const { error } = await db.from('screener_questions').insert(items);
  if (error) throw error;
  console.log(`seeded ${items.length} screener questions`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 8: Responses seed script (Claude-only default; swap entries for GPT/Gemini if keys exist)**

Create `scripts/seed-responses.ts`:

```ts
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from '../lib/supabase';

const anthropic = new Anthropic();

async function claude(model: string, prompt: string, systemPrefix = ''): Promise<string> {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system: systemPrefix || undefined,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  return block.type === 'text' ? block.text : '';
}

async function main() {
  const db = supabaseService();
  const { data: scenarios, error } = await db.from('scenarios').select('*').order('id');
  if (error) throw error;
  if (!scenarios?.length) throw new Error('seed scenarios first');

  await db.from('responses').delete().gte('id', 0);

  const models: { name: string; run: (p: string) => Promise<string> }[] = [
    { name: 'claude-opus-4-7',   run: p => claude('claude-opus-4-7', p) },
    { name: 'claude-sonnet-4-6', run: p => claude('claude-sonnet-4-6', p) },
    { name: 'claude-haiku-4-5',  run: p => claude('claude-haiku-4-5-20251001', p) },
    { name: 'claude-opus-blunt', run: p => claude('claude-opus-4-7', p, 'Respond in a blunt, no-fluff tone. Do not soften.') },
  ];

  const rows: { scenario_id: number; model: string; text: string }[] = [];
  for (const sc of scenarios) {
    for (const m of models) {
      console.log(`scenario ${sc.id} × ${m.name}`);
      rows.push({ scenario_id: sc.id, model: m.name, text: await m.run(sc.prompt) });
    }
  }
  const { error: insErr } = await db.from('responses').insert(rows);
  if (insErr) throw insErr;
  console.log(`seeded ${rows.length} responses`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9: Orchestrator (uses `spawnSync` with explicit args — no shell)**

Create `scripts/run-all-seeds.ts`:

```ts
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const commands: string[][] = [
  ['npx', 'tsx', 'scripts/seed-scenarios.ts'],
  ['npx', 'tsx', 'scripts/seed-screener.ts'],
  ['npx', 'tsx', 'scripts/seed-responses.ts'],
];

for (const cmd of commands) {
  console.log(`\n> ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`command failed with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}
```

- [ ] **Step 10: Run the seeds**

```bash
npm run seed
```

Expected in Supabase: 20 scenarios, 5 screener questions, 80 responses. The responses run takes ~80 API calls, roughly 1–4 minutes depending on rate limits.

- [ ] **Step 11: Create one test invite**

In Supabase SQL editor:

```sql
insert into experts (invite_token) values ('test-token-abc') returning id, invite_token;
```

This lets local testing go to `http://localhost:3000/invite/test-token-abc`.

- [ ] **Step 12: Commit**

Note: `data/scenarios.json`, `data/scenarios-prompt.txt`, and `scripts/generate-scenarios.ts` were already committed in Step 4. This commit catches the remaining seed plumbing.

```bash
git add data/screener.json scripts/seed-scenarios.ts scripts/seed-screener.ts scripts/seed-responses.ts scripts/run-all-seeds.ts package.json
git commit -m "feat(seed): EQ-Bench screener items, frozen model responses, seed orchestrator"
```

---

## Task 6: Assignment logic (TDD)

**Files:**
- Create: `lib/assignments.ts`, `tests/assignments.test.ts`

Why a separate task: the assignment decision is pure logic (given current grader counts, return the 10 scenarios that bring the grid closest to balance). Unit-testable without a DB. The DB-writing wrapper is thin and lives in `lib/assignments.ts` too.

- [ ] **Step 1: Write the failing test**

Create `tests/assignments.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickScenariosForNewExpert } from '@/lib/assignments';

describe('pickScenariosForNewExpert', () => {
  it('picks the N scenarios with the fewest current graders', () => {
    const counts = new Map<number, number>([
      [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
      [6, 1], [7, 1], [8, 2], [9, 2], [10, 3],
      [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
      [16, 0], [17, 0], [18, 0], [19, 0], [20, 0],
    ]);
    const picked = pickScenariosForNewExpert({
      graderCounts: counts,
      scenariosPerExpert: 10,
      gradersPerScenario: 3,
    });
    expect(picked).toHaveLength(10);
    // All picks must currently have < 3 graders
    for (const id of picked) expect(counts.get(id)!).toBeLessThan(3);
    // Prefer the lowest counts: the 10 zeros should all be picked before any 1s or 2s
    for (const id of picked) expect(counts.get(id)!).toBe(0);
  });

  it('excludes scenarios already at the grader cap', () => {
    const counts = new Map<number, number>([
      [1, 3], [2, 3], [3, 3], [4, 0], [5, 0],
    ]);
    const picked = pickScenariosForNewExpert({
      graderCounts: counts,
      scenariosPerExpert: 10,
      gradersPerScenario: 3,
    });
    expect(picked).toEqual([4, 5]);
  });

  it('breaks ties by ascending scenario id', () => {
    const counts = new Map<number, number>([
      [3, 0], [1, 0], [2, 0],
    ]);
    const picked = pickScenariosForNewExpert({
      graderCounts: counts,
      scenariosPerExpert: 2,
      gradersPerScenario: 3,
    });
    expect(picked).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `@/lib/assignments` not found.

- [ ] **Step 3: Implement**

Create `lib/assignments.ts`:

```ts
import { supabaseService } from './supabase';

export const SCENARIOS_PER_EXPERT = 10;
export const GRADERS_PER_SCENARIO = 3;

export function pickScenariosForNewExpert(opts: {
  graderCounts: Map<number, number>;
  scenariosPerExpert: number;
  gradersPerScenario: number;
}): number[] {
  const candidates = [...opts.graderCounts.entries()]
    .filter(([, count]) => count < opts.gradersPerScenario)
    .sort(([idA, a], [idB, b]) => a - b || idA - idB)
    .map(([id]) => id);
  return candidates.slice(0, opts.scenariosPerExpert);
}

export async function assignNewExpert(expertId: string): Promise<number[]> {
  const db = supabaseService();
  const { data: scenarios } = await db.from('scenarios').select('id');
  if (!scenarios?.length) return [];

  const { data: existing } = await db.from('assignments').select('scenario_id');
  const counts = new Map<number, number>();
  for (const s of scenarios) counts.set(s.id, 0);
  for (const a of existing ?? []) {
    counts.set(a.scenario_id, (counts.get(a.scenario_id) ?? 0) + 1);
  }

  const picks = pickScenariosForNewExpert({
    graderCounts: counts,
    scenariosPerExpert: SCENARIOS_PER_EXPERT,
    gradersPerScenario: GRADERS_PER_SCENARIO,
  });
  if (!picks.length) return [];

  const rows = picks.map(scenario_id => ({ expert_id: expertId, scenario_id }));
  const { error } = await db.from('assignments').insert(rows);
  if (error) throw error;
  return picks;
}

export async function getAssignedScenarioIds(expertId: string): Promise<number[]> {
  const db = supabaseService();
  const { data } = await db
    .from('assignments')
    .select('scenario_id')
    .eq('expert_id', expertId)
    .order('scenario_id');
  return (data ?? []).map(a => a.scenario_id);
}
```

- [ ] **Step 4: Run to confirm green**

```bash
npm test
```

Expected: PASS — 3 new assignments tests + prior tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/assignments.ts tests/assignments.test.ts
git commit -m "feat(assignments): auto-balancing 3-graders-per-scenario allocator"
```

---

## Task 7: Invite + onboarding flow

**Files:**
- Create: `lib/session.ts`, `app/invite/[token]/page.tsx`, `app/api/consent/route.ts`, `app/onboarding/page.tsx`, `app/api/onboarding/route.ts`

- [ ] **Step 1: Session helpers**

Create `lib/session.ts`:

```ts
import { cookies } from 'next/headers';
import { supabaseService } from './supabase';
import type { Expert } from './types';

const COOKIE = 'expert_id';

export async function setExpertCookie(id: string) {
  const c = await cookies();
  c.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}

export async function getExpert(): Promise<Expert | null> {
  const c = await cookies();
  const id = c.get(COOKIE)?.value;
  if (!id) return null;
  const db = supabaseService();
  const { data } = await db.from('experts').select('*').eq('id', id).single();
  return (data as Expert) ?? null;
}
```

- [ ] **Step 2: Invite page**

Create `app/invite/[token]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = supabaseService();
  const { data: expert } = await db.from('experts').select('id').eq('invite_token', token).single();
  if (!expert) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form action="/api/consent" method="POST" className="max-w-xl space-y-6">
        <input type="hidden" name="token" value={token} />
        <h1 className="text-2xl font-semibold">Welcome to the EQ Apologies study</h1>
        <p>
          You've been invited to help evaluate how well AI models write apologies on behalf of people
          in hard situations. You will read scenarios and rate four responses per scenario on three
          dimensions. Expect about 40 minutes.
        </p>
        <div className="rounded border p-4 bg-amber-50">
          <strong>Content warning:</strong> scenarios describe interpersonal conflict (neglect, betrayal,
          boundary violations). You may exit at any time.
        </div>
        <label className="flex gap-2 items-start">
          <input type="checkbox" name="consent" required />
          <span>
            I consent to my ratings and written reasoning being published as part of a public benchmark
            dataset, attributed only as "Expert N". I may request removal at any time.
          </span>
        </label>
        <button type="submit" className="px-4 py-2 rounded bg-black text-white">I agree — continue</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Consent API**

Create `app/api/consent/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { setExpertCookie } from '@/lib/session';

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get('token') ?? '');
  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 400 });
  const db = supabaseService();
  const { data: expert, error } = await db
    .from('experts').select('id').eq('invite_token', token).single();
  if (error || !expert) return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  await db.from('experts').update({ consent_at: new Date().toISOString() }).eq('id', expert.id);
  await setExpertCookie(expert.id);
  return NextResponse.redirect(new URL('/onboarding', req.url), { status: 303 });
}
```

- [ ] **Step 4: Onboarding page**

Create `app/onboarding/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';

export default async function OnboardingPage() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (expert.screener_passed) redirect('/project');
  if (expert.name) redirect('/screener');

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form action="/api/onboarding" method="POST" className="max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">Tell us about yourself</h1>
        <label className="block">
          <span className="block text-sm mb-1">First name or pseudonym</span>
          <input name="name" required className="w-full border rounded p-2" />
        </label>
        <label className="block">
          <span className="block text-sm mb-1">
            Anything relevant to your emotional-intelligence background (therapy, writing, teaching,
            caretaking, etc.)? Optional.
          </span>
          <textarea name="background" rows={4} className="w-full border rounded p-2" />
        </label>
        <button type="submit" className="px-4 py-2 rounded bg-black text-white">Start screener</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Onboarding API**

Create `app/api/onboarding/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getExpert } from '@/lib/session';

export async function POST(req: Request) {
  const expert = await getExpert();
  if (!expert) return NextResponse.redirect(new URL('/', req.url), { status: 303 });
  const form = await req.formData();
  const name = String(form.get('name') ?? '').trim();
  const background = String(form.get('background') ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const db = supabaseService();
  await db.from('experts').update({ name, background }).eq('id', expert.id);
  return NextResponse.redirect(new URL('/screener', req.url), { status: 303 });
}
```

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:3000/invite/test-token-abc`. Check consent → continue. Fill onboarding → submit. Expect to land on `/screener` (404 until next task). Verify in Supabase: the `test-token-abc` expert row now has `consent_at`, `name`, `background`.

- [ ] **Step 7: Commit**

```bash
git add lib/session.ts app/invite app/onboarding app/api/consent app/api/onboarding
git commit -m "feat(experts): invite consent + onboarding flow"
```

---

## Task 8: Screener page + submission

**Files:**
- Create: `app/screener/page.tsx`, `app/screener/form.tsx`, `app/api/screener/submit/route.ts`, `app/screener/thanks/page.tsx`

- [ ] **Step 1: Server page**

Create `app/screener/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';
import ScreenerForm from './form';

export default async function ScreenerPage() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (expert.screener_passed === true) redirect('/project');
  if (expert.screener_passed === false) redirect('/screener/thanks');

  const db = supabaseService();
  const { data: questions } = await db.from('screener_questions').select('*').order('id');
  return <ScreenerForm questions={questions ?? []} />;
}
```

- [ ] **Step 2: Client form**

Create `app/screener/form.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { ScreenerQuestion } from '@/lib/types';

export default function ScreenerForm({ questions }: { questions: ScreenerQuestion[] }) {
  const [values, setValues] = useState<Record<number, number[]>>(
    Object.fromEntries(questions.map(q => [q.id, q.emotions.map(() => 5)]))
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/screener/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: values }),
    });
    if (res.redirected) window.location.href = res.url;
    else setBusy(false);
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">EQ Screener</h1>
      <p className="text-neutral-600">
        Read each dialogue, then set the slider for how strongly the character feels each emotion
        (0 = not at all, 10 = intense). Your answers are compared to a reference.
      </p>
      <form onSubmit={submit} className="space-y-10">
        {questions.map((q, idx) => (
          <div key={q.id} className="border rounded p-4 space-y-4">
            <h2 className="font-medium">Scenario {idx + 1}</h2>
            <pre className="whitespace-pre-wrap text-sm">{q.prompt}</pre>
            {q.emotions.map((emo, i) => (
              <label key={emo} className="block">
                <div className="flex justify-between text-sm">
                  <span>{emo}</span>
                  <span>{values[q.id][i]}</span>
                </div>
                <input
                  type="range" min={0} max={10} step={1}
                  value={values[q.id][i]}
                  onChange={e => {
                    const next = [...values[q.id]];
                    next[i] = Number(e.target.value);
                    setValues({ ...values, [q.id]: next });
                  }}
                  className="w-full"
                />
              </label>
            ))}
          </div>
        ))}
        <button type="submit" disabled={busy} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
          {busy ? 'Scoring…' : 'Submit screener'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Submission API**

Create `app/api/screener/submit/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getExpert } from '@/lib/session';
import { meanAbsoluteDeviation, screenerPassed, SCREENER_MAD_THRESHOLD } from '@/lib/scoring';
import { assignNewExpert } from '@/lib/assignments';

export async function POST(req: Request) {
  const expert = await getExpert();
  if (!expert) return NextResponse.redirect(new URL('/', req.url), { status: 303 });

  const { answers } = (await req.json()) as { answers: Record<string, number[]> };
  const db = supabaseService();
  const { data: questions } = await db.from('screener_questions').select('*').order('id');
  if (!questions?.length) return NextResponse.json({ error: 'no questions' }, { status: 500 });

  const rows: { expert_id: string; question_id: number; predicted_intensities: number[]; abs_deviation: number }[] = [];
  const allDeviations: number[] = [];

  for (const q of questions) {
    const predicted = answers[q.id] ?? answers[String(q.id)] ?? [];
    const ref = q.reference_intensities as number[];
    const mad = meanAbsoluteDeviation(predicted, ref);
    rows.push({ expert_id: expert.id, question_id: q.id, predicted_intensities: predicted, abs_deviation: mad });
    for (let i = 0; i < predicted.length; i++) allDeviations.push(Math.abs(predicted[i] - ref[i]));
  }

  const aggregate = allDeviations.reduce((a, b) => a + b, 0) / allDeviations.length;
  const passed = screenerPassed(aggregate, SCREENER_MAD_THRESHOLD);

  await db.from('screener_answers').delete().eq('expert_id', expert.id);
  await db.from('screener_answers').insert(rows);
  await db.from('experts').update({ screener_passed: passed, screener_mad: aggregate }).eq('id', expert.id);

  if (passed) {
    // Idempotent in practice because of the unique(expert_id, scenario_id) constraint,
    // but we skip re-assignment if this expert already has assignments.
    const { count } = await db
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('expert_id', expert.id);
    if (!count) await assignNewExpert(expert.id);
  }

  return NextResponse.redirect(new URL(passed ? '/project' : '/screener/thanks', req.url), { status: 303 });
}
```

- [ ] **Step 4: Graceful fail page**

Create `app/screener/thanks/page.tsx`:

```tsx
export default function ScreenerThanks() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4">
        <h1 className="text-2xl font-semibold">Thanks for giving it a try</h1>
        <p>
          Your answers were thoughtful, but for this specific study we are looking for a narrow match
          to a pre-set emotional-intensity reference. That match didn't line up this time. We appreciate
          your time and care.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Smoke test**

With `npm run dev`, submit the screener. Verify: `screener_answers` has 5 rows, `experts.screener_passed` + `screener_mad` populated, correct redirect. If you need to force a pass while developing, set `screener_passed = true` in Supabase manually and re-visit `/screener`.

- [ ] **Step 6: Commit**

```bash
git add app/screener app/api/screener
git commit -m "feat(screener): EQ-Bench intensity screener + MAD gating"
```

---

## Task 9: Labeling UI + submission

**Files:**
- Create: `app/project/page.tsx`, `app/project/scenario/[i]/page.tsx`, `app/project/scenario/[i]/form.tsx`, `app/api/label/route.ts`, `app/done/page.tsx`

- [ ] **Step 1: Project landing**

Create `app/project/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';
import { getAssignedScenarioIds } from '@/lib/assignments';

export default async function ProjectLanding() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (!expert.screener_passed) redirect('/screener');

  const assignedIds = await getAssignedScenarioIds(expert.id);
  const db = supabaseService();
  const { data: labeled } = await db
    .from('labels')
    .select('response_id, responses!inner(scenario_id)')
    .eq('expert_id', expert.id);

  const completedScenarios = new Set((labeled ?? []).map((l: any) => l.responses.scenario_id));
  const firstTodo = assignedIds.find(id => !completedScenarios.has(id));

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">You're in</h1>
      <p>
        You have {assignedIds.length} assigned scenarios to label. For each, rate 4 responses (A–D) on
        accountability, specificity, and warmth. Expect about 40 minutes.
      </p>
      <p className="text-sm text-neutral-500">
        Completed: {completedScenarios.size} / {assignedIds.length}
      </p>
      {firstTodo ? (
        <Link href={`/project/scenario/${firstTodo}`} className="inline-block px-4 py-2 rounded bg-black text-white">
          {completedScenarios.size === 0 ? 'Start labeling' : 'Resume'}
        </Link>
      ) : (
        <Link href="/done" className="inline-block px-4 py-2 rounded bg-black text-white">Finish</Link>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Scenario page (server)**

Create `app/project/scenario/[i]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';
import { blindingOrder } from '@/lib/blinding';
import { getAssignedScenarioIds } from '@/lib/assignments';
import ScenarioForm from './form';

export default async function ScenarioPage({ params }: { params: Promise<{ i: string }> }) {
  const { i } = await params;
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (!expert.screener_passed) redirect('/screener');

  const scenarioId = Number(i);
  const assigned = await getAssignedScenarioIds(expert.id);
  if (!assigned.includes(scenarioId)) notFound();

  const db = supabaseService();
  const { data: scenario } = await db.from('scenarios').select('*').eq('id', scenarioId).single();
  if (!scenario) notFound();
  const { data: responses } = await db.from('responses').select('*').eq('scenario_id', scenarioId);
  if (!responses?.length) notFound();

  const ordered = blindingOrder(responses, expert.id, scenarioId);
  const responseIds = ordered.map(r => r.id);
  const { data: existing } = await db
    .from('labels')
    .select('response_id, accountability, specificity, warmth, reasoning')
    .eq('expert_id', expert.id)
    .in('response_id', responseIds);

  const idx = assigned.findIndex(id => id === scenarioId);
  const nextScenarioId = assigned[idx + 1] ?? null;

  return (
    <ScenarioForm
      scenario={scenario}
      responses={ordered}
      existing={existing ?? []}
      nextScenarioId={nextScenarioId}
    />
  );
}
```

- [ ] **Step 3: Scenario form (client)**

Create `app/project/scenario/[i]/form.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { Scenario, ModelResponse } from '@/lib/types';

type Existing = {
  response_id: number;
  accountability: number;
  specificity: number;
  warmth: number;
  reasoning: string | null;
};

export default function ScenarioForm({
  scenario, responses, existing, nextScenarioId,
}: {
  scenario: Scenario;
  responses: ModelResponse[];
  existing: Existing[];
  nextScenarioId: number | null;
}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const initial: Record<number, { acc: number; spec: number; warmth: number; reasoning: string }> =
    Object.fromEntries(responses.map(r => {
      const e = existing.find(x => x.response_id === r.id);
      return [r.id, {
        acc: e?.accountability ?? 3,
        spec: e?.specificity ?? 3,
        warmth: e?.warmth ?? 3,
        reasoning: e?.reasoning ?? '',
      }];
    }));
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    for (const r of responses) {
      const v = values[r.id];
      await fetch('/api/label', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          response_id: r.id,
          accountability: v.acc, specificity: v.spec, warmth: v.warmth,
          reasoning: v.reasoning,
        }),
      });
    }
    window.location.href = nextScenarioId ? `/project/scenario/${nextScenarioId}` : '/done';
  }

  const labels: Record<'acc' | 'spec' | 'warmth', string> = {
    acc: 'Accountability',
    spec: 'Specificity',
    warmth: 'Warmth',
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Scenario</h1>
        <pre className="whitespace-pre-wrap bg-neutral-50 border rounded p-4 text-sm mt-2">
          {scenario.prompt}
        </pre>
      </div>
      <form onSubmit={submit} className="space-y-8">
        {responses.map((r, i) => {
          const v = values[r.id];
          return (
            <div key={r.id} className="border rounded p-4 space-y-3">
              <h2 className="font-medium">Response {letters[i]}</h2>
              <pre className="whitespace-pre-wrap bg-white border rounded p-3 text-sm">{r.text}</pre>
              {(['acc', 'spec', 'warmth'] as const).map(key => (
                <label key={key} className="block">
                  <div className="flex justify-between text-sm">
                    <span>{labels[key]}</span>
                    <span>{v[key]}</span>
                  </div>
                  <input
                    type="range" min={1} max={5} step={1} value={v[key]}
                    onChange={e => setValues({
                      ...values,
                      [r.id]: { ...v, [key]: Number(e.target.value) },
                    })}
                    className="w-full"
                  />
                </label>
              ))}
              <label className="block">
                <span className="block text-sm mb-1">What would make this apology better? (optional)</span>
                <textarea
                  rows={2} value={v.reasoning}
                  onChange={e => setValues({
                    ...values, [r.id]: { ...v, reasoning: e.target.value },
                  })}
                  className="w-full border rounded p-2"
                />
              </label>
            </div>
          );
        })}
        <button type="submit" disabled={busy} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
          {busy ? 'Saving…' : nextScenarioId ? 'Save & next scenario' : 'Save & finish'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Label API**

Create `app/api/label/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';

const Payload = z.object({
  response_id: z.number().int(),
  accountability: z.number().int().min(1).max(5),
  specificity: z.number().int().min(1).max(5),
  warmth: z.number().int().min(1).max(5),
  reasoning: z.string().optional().default(''),
});

export async function POST(req: Request) {
  const expert = await getExpert();
  if (!expert) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = Payload.parse(await req.json());
  const db = supabaseService();
  const { error } = await db.from('labels').upsert(
    { expert_id: expert.id, ...body },
    { onConflict: 'expert_id,response_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Done page**

Create `app/done/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';

export default async function DonePage() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  const db = supabaseService();
  const { count } = await db
    .from('labels')
    .select('*', { count: 'exact', head: true })
    .eq('expert_id', expert.id);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4">
        <h1 className="text-2xl font-semibold">Thank you, {expert.name}</h1>
        <p>You submitted {count ?? 0} labels. We'll be in touch if we need anything else.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Smoke test**

With dev server running, log in via `/invite/test-token-abc`. If your screener failed, flip `screener_passed=true` manually in Supabase. Visit `/project`. Label one scenario end-to-end. Verify:
- 4 rows in `labels` for that expert/scenario
- Navigation advances to scenario 2
- Refreshing mid-scenario shows saved slider values

- [ ] **Step 7: Commit**

```bash
git add app/project app/api/label app/done
git commit -m "feat(labeling): 3-dim Likert rubric with free-text reasoning"
```

---

## Task 10: Admin dashboard + JSONL export (TDD on assembly)

**Files:**
- Create: `lib/admin-auth.ts`, `lib/export.ts`, `tests/export.test.ts`, `middleware.ts`, `app/admin/page.tsx`, `app/admin/export.jsonl/route.ts`

- [ ] **Step 1: Failing test for export row assembly**

Create `tests/export.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assembleExportRow } from '@/lib/export';

describe('assembleExportRow', () => {
  it('assembles a single JSON row from joined parts', () => {
    const row = assembleExportRow({
      expert: { id: 'exp-1', background: 'therapist' },
      scenario: { id: 1, prompt: 'help me apologize', metadata: { severity: 'high' } },
      response: { id: 10, scenario_id: 1, model: 'claude-opus-4-7', text: 'I am sorry' },
      label: {
        expert_id: 'exp-1', response_id: 10,
        accountability: 4, specificity: 5, warmth: 3,
        reasoning: 'warm but vague', submitted_at: '2026-04-19T12:00:00Z',
      },
    });
    expect(row).toEqual({
      expert_id: 'exp-1',
      expert_background: 'therapist',
      scenario_id: 1,
      scenario_prompt: 'help me apologize',
      scenario_metadata: { severity: 'high' },
      response_id: 10,
      model: 'claude-opus-4-7',
      response_text: 'I am sorry',
      scores: { accountability: 4, specificity: 5, warmth: 3 },
      reasoning: 'warm but vague',
      submitted_at: '2026-04-19T12:00:00Z',
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement assembly**

Create `lib/export.ts`:

```ts
export type ExportInput = {
  expert: { id: string; background: string | null };
  scenario: { id: number; prompt: string; metadata: Record<string, unknown> };
  response: { id: number; scenario_id: number; model: string; text: string };
  label: {
    expert_id: string;
    response_id: number;
    accountability: number;
    specificity: number;
    warmth: number;
    reasoning: string | null;
    submitted_at: string;
  };
};

export function assembleExportRow(i: ExportInput) {
  return {
    expert_id: i.expert.id,
    expert_background: i.expert.background,
    scenario_id: i.scenario.id,
    scenario_prompt: i.scenario.prompt,
    scenario_metadata: i.scenario.metadata,
    response_id: i.response.id,
    model: i.response.model,
    response_text: i.response.text,
    scores: {
      accountability: i.label.accountability,
      specificity: i.label.specificity,
      warmth: i.label.warmth,
    },
    reasoning: i.label.reasoning ?? '',
    submitted_at: i.label.submitted_at,
  };
}
```

- [ ] **Step 4: Run to confirm green**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Basic-auth middleware**

Create `middleware.ts` at the repo root (same level as `app/`):

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/admin')) return NextResponse.next();

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return new NextResponse('Admin password not set', { status: 500 });

  const auth = req.headers.get('authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  if (scheme === 'Basic' && token) {
    const [, pass] = Buffer.from(token, 'base64').toString().split(':');
    if (pass === expected) return NextResponse.next();
  }
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="admin"' },
  });
}

export const config = { matcher: ['/admin/:path*'] };
```

- [ ] **Step 6: Admin dashboard page**

Create `app/admin/page.tsx`:

```tsx
import { supabaseService } from '@/lib/supabase';

export default async function AdminDashboard() {
  const db = supabaseService();
  const [{ count: experts }, { count: consented }, { count: passed }, { count: labels }] = await Promise.all([
    db.from('experts').select('*', { count: 'exact', head: true }),
    db.from('experts').select('*', { count: 'exact', head: true }).not('consent_at', 'is', null),
    db.from('experts').select('*', { count: 'exact', head: true }).eq('screener_passed', true),
    db.from('labels').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <ul className="space-y-1">
        <li>Experts invited: {experts ?? 0}</li>
        <li>Consented: {consented ?? 0}</li>
        <li>Screener passed: {passed ?? 0}</li>
        <li>Labels submitted: {labels ?? 0}</li>
      </ul>
      <a href="/admin/export.jsonl" className="inline-block px-4 py-2 rounded bg-black text-white">
        Download JSONL
      </a>
    </main>
  );
}
```

- [ ] **Step 7: Export endpoint**

Create `app/admin/export.jsonl/route.ts`:

```ts
import { supabaseService } from '@/lib/supabase';
import { assembleExportRow } from '@/lib/export';

export async function GET() {
  const db = supabaseService();
  const { data } = await db
    .from('labels')
    .select(`
      *,
      experts(id, background),
      responses(id, scenario_id, model, text, scenarios(id, prompt, metadata))
    `);

  const lines = (data ?? []).map((l: any) =>
    JSON.stringify(assembleExportRow({
      expert: { id: l.experts.id, background: l.experts.background },
      scenario: {
        id: l.responses.scenarios.id,
        prompt: l.responses.scenarios.prompt,
        metadata: l.responses.scenarios.metadata ?? {},
      },
      response: {
        id: l.responses.id,
        scenario_id: l.responses.scenario_id,
        model: l.responses.model,
        text: l.responses.text,
      },
      label: {
        expert_id: l.expert_id,
        response_id: l.response_id,
        accountability: l.accountability,
        specificity: l.specificity,
        warmth: l.warmth,
        reasoning: l.reasoning,
        submitted_at: l.submitted_at,
      },
    }))
  );

  const body = lines.length ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson',
      'content-disposition': 'attachment; filename="eq-apologies-labels.jsonl"',
    },
  });
}
```

- [ ] **Step 8: Smoke test**

Run `npm run dev`, visit `/admin`. Browser prompts for basic auth — any username, password = your `ADMIN_PASSWORD`. See counts. Click Download JSONL. Expect a file with one valid JSON object per line.

- [ ] **Step 9: Commit**

```bash
git add lib/admin-auth.ts lib/export.ts tests/export.test.ts middleware.ts app/admin
git commit -m "feat(admin): dashboard + JSONL export gated by basic auth"
```

---

## Task 11: README, Vercel config, deploy

**Files:**
- Create: `README.md`, `vercel.ts`

- [ ] **Step 1: README**

Create `README.md`:

```markdown
# The Soul Problem — EQ Apologies Data Collection

Expert-labeled benchmark of LLM responses to apology-writing prompts.

## Quickstart

1. `cp .env.example .env.local` and fill in Supabase + Anthropic keys
2. Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor
3. `npm install`
4. `npm run seed` — populates scenarios, screener, and model responses
5. Insert a test expert in Supabase: `insert into experts (invite_token) values ('test-token-abc');`
6. `npm run dev` → visit `/invite/test-token-abc`

## Routes

| Path | Purpose |
| --- | --- |
| `/invite/[token]` | Expert consent |
| `/onboarding` | Name + background |
| `/screener` | EQ-Bench intensity test |
| `/project` | Labeling landing |
| `/project/scenario/[i]` | Per-scenario labeling |
| `/done` | Completion |
| `/admin` | Dashboard + export (basic auth) |

## Exporting data

Visit `/admin/export.jsonl` authenticated as admin (any username, password = `ADMIN_PASSWORD`). One JSON object per (expert, response).

## Design + implementation docs

- Spec: `docs/superpowers/specs/2026-04-19-eq-apologies-data-collection-platform-design.md`
- Plan: `docs/superpowers/plans/2026-04-19-eq-apologies-data-collection-platform.md`

## Ethics

- Model identity is blinded per expert per scenario
- Experts consent before labeling; names are stripped from export
- Rubric encodes one Western-therapeutic model of "good apology"; documented as a limitation
```

- [ ] **Step 2: Vercel config**

```bash
npm install -D @vercel/config
```

Create `vercel.ts`:

```ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  framework: 'nextjs',
};
```

- [ ] **Step 3: Deploy**

If the Vercel CLI is not installed:

```bash
npm i -g vercel
```

Then:

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ADMIN_PASSWORD
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

- [ ] **Step 4: Smoke-test production**

On the prod URL:
1. Visit `/invite/test-token-abc` → consent → onboarding
2. Submit screener (set `screener_passed=true` manually if needed)
3. Label scenario 1
4. Visit `/admin` → counts reflect the label
5. Download `/admin/export.jsonl` → verify contents

- [ ] **Step 5: Commit + tag**

```bash
git add README.md vercel.ts package.json package-lock.json
git commit -m "chore: README, Vercel config, production deploy"
git tag v0.1.0-hackathon
```

---

## Appendix: what is intentionally not in v1

- **No inter-rater reliability calc UI.** Duplicate labels exist for audit scenarios; compute α offline.
- **No true partition logic.** Every passing expert labels all 10 scenarios.
- **No magic-link auth, no email.** Invite tokens only.
- **No Claude runtime calls.** All model responses frozen at seed time.
- **No per-response save acknowledgement.** Labels submit on scenario navigation.
- **No admin CRUD.** One hardcoded project.
