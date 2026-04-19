# EQ Apologies — Data Collection Platform (v1)

**Date:** 2026-04-19
**Status:** Design approved; ready for implementation plan
**Owner:** sumeet.mehra@gmail.com

## Problem

LLMs are widely used for emotionally high-stakes communication (apologies, grief, boundaries, vulnerability) but there is no measurable public standard of emotional intelligence in these tasks. We need a labeled benchmark of model responses to apology-writing requests, rated by vetted high-EQ experts sourced via AfterQuery.

## Scope (v1)

A hosted web platform that:

1. Invites expert labelers via unique invite-token URLs
2. Screens labelers with a short EQ test (gating)
3. Collects rubric Likert ratings + free-text reasoning on model responses for a fixed set of apology scenarios
4. Exports labeled data as JSONL for downstream benchmarking

### Out of scope (v1)

- Fine-tuning Qwen or any model
- Public leaderboard / viz
- HuggingFace auto-publish
- Admin CRUD for multiple projects (one hardcoded project)
- SSO / account recovery flows

## Success criteria

- **20 apology scenarios × 4 model responses = 80 response units in DB**
- **Target: each scenario is labeled by exactly 3 qualifying experts** → at steady state, 3 × 80 = 240 labels
- Assignments auto-balance: each newly passing expert gets the 10 scenarios with the fewest current graders (first-come, first-served, capped at 3 graders per scenario)
- One-click JSONL export producing the schema below
- Demo-acceptable minimum: at least 2 experts complete their 10-scenario assignments → ≥ 80 labels

## Architecture

| Layer | Choice | Rationale |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Vercel-native, SSR polish, shadcn ecosystem |
| Hosting | Vercel | Greenfield context; Fluid Compute default |
| DB + auth | Supabase (Postgres) | Managed, fast to set up via Vercel Marketplace |
| Auth | Invite-token in URL (no password) | Hackathon scope; magic-link deferred |
| UI | Tailwind + shadcn/ui | Fastest polished path |
| Admin auth | Shared basic-auth password via env var | Sufficient for hackathon demo |
| LLM | Claude via Anthropic SDK | Only used in the seeding script to generate frozen apology responses; not called at runtime in v1 |

## User flows

### Expert flow

1. `/invite/[token]` — land, see project brief, content warning (apology scenarios include conflict/harm), consent checkbox
2. `/onboarding` — name, self-identified relevant background (free text), consent confirmation
3. `/screener` — 5 EQ-Bench-style scenarios. For each dialogue, expert predicts 4 pre-selected emotion intensities on 0–10 sliders. Auto-scored against reference answers.
4. Branch:
   - Pass (mean absolute deviation ≤ 3.0, see Screener design) → `/project`
   - Fail → `/screener/thanks` (graceful exit, no shame)
5. `/project/scenario/[i]` — 10 **assigned** scenarios (out of 20 total), one at a time:
   - User apology request shown at top
   - 4 model responses labeled `A`, `B`, `C`, `D` (model identity blinded, letter-to-model mapping randomized once per expert per scenario; the export uses the underlying `responses.model` to un-blind)
   - Per response: 3 Likert sliders (1–5) + short free-text "what would make this better?"
6. `/done` — confirmation, thank-you, optional feedback textarea

### Admin flow

- `/admin` — basic-auth gate. Shows:
  - Experts invited / onboarded / passed / completed
  - Per-scenario completion counts
  - Export JSONL button
- `/admin/export.jsonl` — streams labeled data in the schema below

## Screener design

**Source:** 5 scenarios sampled from the EQ-Bench validation split (MIT-licensed, 171 scenarios available).

**Format:** Each scenario presents a dialogue + 4 named emotions. Expert sets intensity 0–10 per emotion.

**Scoring:** Mean absolute deviation (MAD) vs reference answers across all 20 predictions (5 × 4).

**Threshold:** start at MAD ≤ 3.0 (permissive); tighten after pilot pass-rate data. Chosen over stricter 2.0 because EQ-Bench intensity predictions are noisy even for humans.

**Why this screener:** free, deterministic grading, no Claude needed, directly emotion-adjacent, published prior art.

**Tradeoff:** encodes EQ-Bench's authors' emotion-intensity ground truth as the filter definition of "high EQ." Documented limitation.

## Labeling rubric

Three dimensions, each 1–5 Likert:

1. **Accountability** — takes responsibility without deflection, JADE (justify / argue / defend / explain), or minimization.
2. **Specificity** — names the actual transgression and its impact; not generalities or performative language.
3. **Warmth** — emotional register is honest and non-performative; lands as sincere rather than robotic or saccharine.

**Free text:** "In 1–2 sentences, what would make this apology better?" — optional; encouraged via UI placeholder.

Rationale for 3 dimensions: small enough that labelers can hold all in their head; covers the dominant failure modes of LLM apologies (deflection, generic phrasing, saccharine tone).

## Partition strategy

- Target: **3 distinct experts per scenario**, **10 scenarios per expert** → 6 experts fill the grid exactly
- Assignment is computed at screener-pass time, not pre-allocated:
  1. For each scenario, count current assignments
  2. Sort scenarios by (current grader count asc, id asc)
  3. Assign the expert to the first 10 scenarios from that sorted list whose count is currently < 3
  4. If fewer than 10 such scenarios remain (the grid is nearly full), assign as many as are available
- This yields natural 3-way inter-rater reliability on every scenario — no separate audit subset needed
- **Labeling load per expert:** 10 scenarios × 4 responses = 40 label units (~40 minutes)

## Data model (Postgres)

```sql
experts (
  id uuid PRIMARY KEY,
  invite_token text UNIQUE NOT NULL,
  name text,
  background text,
  consent_at timestamptz,
  screener_passed boolean,
  screener_mad real,
  created_at timestamptz DEFAULT now()
)

scenarios (
  id serial PRIMARY KEY,
  prompt text NOT NULL,
  metadata jsonb  -- relationship, transgression_type, severity
)

responses (
  id serial PRIMARY KEY,
  scenario_id int REFERENCES scenarios(id),
  model text NOT NULL,  -- e.g. "claude-opus-4-7", "gpt-4o", "gemini-1.5-pro", "qwen-0.5b-base"
  text text NOT NULL
)

labels (
  id serial PRIMARY KEY,
  expert_id uuid REFERENCES experts(id),
  response_id int REFERENCES responses(id),
  accountability int CHECK (accountability BETWEEN 1 AND 5),
  specificity int CHECK (specificity BETWEEN 1 AND 5),
  warmth int CHECK (warmth BETWEEN 1 AND 5),
  reasoning text,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(expert_id, response_id)
)

screener_questions (
  id serial PRIMARY KEY,
  prompt text NOT NULL,
  emotions jsonb NOT NULL,          -- ["Remorseful", "Indifferent", ...]
  reference_intensities jsonb NOT NULL  -- [2, 3, 0, 5]
)

screener_answers (
  id serial PRIMARY KEY,
  expert_id uuid REFERENCES experts(id),
  question_id int REFERENCES screener_questions(id),
  predicted_intensities jsonb NOT NULL,
  abs_deviation real NOT NULL,
  UNIQUE(expert_id, question_id)
)

assignments (
  id serial PRIMARY KEY,
  expert_id uuid REFERENCES experts(id) ON DELETE CASCADE,
  scenario_id int REFERENCES scenarios(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(expert_id, scenario_id)
)
```

Constants (env-tunable but fixed for v1):

- `SCENARIOS_TOTAL = 20`
- `GRADERS_PER_SCENARIO = 3`
- `SCENARIOS_PER_EXPERT = 10`

## Export schema (JSONL)

One object per (expert, response) row:

```json
{
  "expert_id": "uuid",
  "expert_background": "string",
  "scenario_id": 1,
  "scenario_prompt": "string",
  "scenario_metadata": {"relationship": "partner", "severity": "medium"},
  "response_id": 12,
  "model": "claude-opus-4-7",
  "response_text": "string",
  "scores": {"accountability": 4, "specificity": 5, "warmth": 3},
  "reasoning": "string",
  "submitted_at": "2026-04-19T17:23:00Z"
}
```

## Seed data requirements

Before launch, populate:

- **20 apology scenarios — LLM-generated** by Claude Opus 4.7 with a diversity-prompted single call. Prompt explicitly requires variety in relationship (partner, parent, sibling, child, friend, coworker, neighbor, dating), transgression type (betrayal, neglect, harm, mistake, boundary violation, dishonesty), and severity (low / medium / high). Output is strict JSON; the seed script validates the schema before inserting. If any item fails validation, the script re-prompts. Manual spot-check after seeding to catch tone outliers.
- **80 model responses** — 20 scenarios × 4 models (default matrix: Claude Opus 4.7, Claude Sonnet 4.6, Claude Haiku 4.5, Claude Opus 4.7 with a "blunt" system prompt — the fourth slot is easy to swap for GPT-4o or Gemini if those API keys are available). Stored at seed time; never regenerated at runtime.
- **5 screener questions** — sampled from the EQ-Bench validation split, stored with reference intensities.

Seeding is a one-time script committed to the repo. Model responses are frozen artifacts, not runtime calls. The scenario-generation prompt and the raw model output are both committed for reproducibility.

## Ethics considerations

- **Labeler psychological load** — apology content involves conflict/harm. Content warning on `/invite` page; explicit opt-out before screener.
- **Consent** — invite page includes checkbox: *"I consent to my ratings and written reasoning being published in a public benchmark dataset (attributed only as 'Expert N'). I can request removal."*
- **PII** — collect name + optional background only; no email. Dataset export strips the `name` field.
- **Model blinding** — responses shown as `A/B/C/D` in randomized order per expert to prevent brand bias.
- **Ground-truth bias** — rubric encodes a Western-therapeutic model of "good apology" (accountability, specificity, warmth). Dataset card will document this limitation explicitly.
- **Screener filtering** — EQ-Bench's reference answers define who qualifies as "high EQ." Privileges the dataset authors' definition; flagged in the readme.
- **Misuse** — this dataset could be used to train models that manipulate emotionally vulnerable users (e.g., more "convincing" deceptive apologies). Mitigation: license with explicit non-manipulation clause in dataset card; do not release until reviewed.

## Open risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Screener too strict → no labelers pass | Medium | Start at MAD ≤ 3.0; tighten after pilot run |
| Labeling time too long → experts abandon | Medium | Budget ~40 min; show progress bar; allow save-and-resume |
| 3 graders per scenario is thin for IRR | Medium | Document as pilot-scale reliability; treat α as indicative not definitive |
| Scenario-generation prompt biases the dataset toward Claude's natural scenario-writing style | Medium | Commit the prompt + raw output; future v2 can mix in human-authored scenarios |
| Fewer than 6 experts pass screener → grid doesn't fill | Medium | Auto-balancing assignment still yields partial but usable coverage; document actual n per scenario in export |
| Supabase quota on free tier | Low | Scale is tiny (≤ 20 experts, ≤ 1000 labels) |
| Claude response generation nondeterministic at seed time | Low | Seed once, freeze artifacts in DB |

## What "shipped" means for the hackathon

- Platform deployed to a public Vercel URL
- DB seeded with 20 LLM-generated scenarios, 80 model responses, 5 screener questions
- Invite-token URL tested end-to-end with a self-label pass on an assigned 10-scenario slice
- Assignment logic verified: one passing expert receives exactly 10 distinct scenarios; a second passing expert's assignment overlaps correctly to keep grader counts balanced
- Admin dashboard shows live counts including per-scenario grader coverage; export produces valid JSONL
- Spec, README, and a short demo script in the repo
