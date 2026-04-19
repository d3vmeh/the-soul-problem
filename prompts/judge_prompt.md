# Judge Prompt — grief_loss_v1

Scores an LLM response against the scenario-specific rubric in `grief_loss_v1.json` and emits an EQ-Bench-style scored output with an `Overall Item Score` on a 0–100 scale.

Reads prose bullet criteria directly from the rubric. No restructuring required.

---

## Scoring rules

- **Positive criteria**: score 1–10 per bullet. 10 = fully exhibited. 1 = absent. 5 = partial.
- **Negative criteria**: score 1–10 per bullet. 10 = severely exhibited (bad). 1 = absent (good). 5 = partial.
- **Dominant criteria**: the 2–3 criteria named in `criteria_weights_hint` get **2× weight** in aggregation. All other criteria weight 1×.
- **Length compliance is NOT scored.** Word-count is a constraint on the response writer, not a judging dimension.

## Aggregation formula

```
positive_raw         = Σ (score × weight)   for positive criteria
positive_max         = Σ (10    × weight)   for positive criteria
negative_raw         = Σ (score × weight)   for negative criteria
negative_max         = Σ (10    × weight)   for negative criteria

positive_normalized  = (positive_raw / positive_max) × 100
negative_normalized  = (negative_raw / negative_max) × 100

Overall Item Score   = (positive_normalized + (100 − negative_normalized)) / 2
```

A perfect response = **100**. A response that scores 1 on every positive and 10 on every negative = **0**.

---

## Judge prompt template (send this to the judge model)

Fill `{{SCENARIO_PROMPT}}`, `{{RESPONSE}}`, `{{POSITIVE_CRITERIA}}`, `{{NEGATIVE_CRITERIA}}`, `{{WEIGHTS_HINT}}`. The score.py harness does the fill-in.

```
You are an expert evaluator of emotionally intelligent writing. You will score an LLM's response to a grief and loss scenario against a scenario-specific rubric. Be strict and literal. Specificity matters more than polish.

## The scenario
{{SCENARIO_PROMPT}}

## The response to evaluate
{{RESPONSE}}

## Rubric — positive criteria (reward; 1=absent, 10=fully exhibited)
{{POSITIVE_CRITERIA}}

## Rubric — negative criteria (penalize; 1=absent, 10=severely exhibited)
{{NEGATIVE_CRITERIA}}

## Weights hint for this scenario
{{WEIGHTS_HINT}}

## Scoring rules
1. Identify 2–3 dominant criteria from the weights hint. Score these FIRST, before the rest.
2. Assign a 1–10 integer to every positive and every negative criterion.
3. Dominant criteria count with 2× weight in the aggregation.
4. Do NOT score length compliance.
5. Do NOT invent criteria. Do NOT skip criteria. Use the bullets as given.
6. Base every score on the response itself. No guessing intent.

## Output format (exact — no preamble, no trailing commentary)

## Dominant criteria (2× weight)
- <short label derived from first clause of criterion>
- <short label>
(- optional third)

## Positive scores
<short label>: <1-10>
<short label>: <1-10>
...

## Negative scores
<short label>: <1-10>
<short label>: <1-10>
...

## Aggregation
Positive raw: <int>
Positive max: <int>
Negative raw: <int>
Negative max: <int>
Positive normalized: <float, 2 decimals>
Negative normalized: <float, 2 decimals>

Overall Item Score: <float, 2 decimals> / 100

## Rationale
<one sentence — the strongest reason this response landed where it did, referencing one specific criterion by label>
```

---

## Calibration notes

- Before running at scale, spot-check 10–15 judge outputs against human ratings. Judge-vs-human agreement is the whole ballgame.
- Negative criteria usually drive the signal — stock grief responses are mediocre on positives and trip hard on negatives.
- These rubrics encode a specific (restrained, anti-platitude, specificity-valued) voice. A fine-tune consuming these scores inherits that voice.
