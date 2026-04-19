# grief_loss_v1 — EQ-Bench-style Grief & Loss Eval Set

50 scenario prompts with per-prompt rubrics for evaluating LLM emotional intelligence in grief and loss contexts.

## Files

| File | Purpose |
|---|---|
| `grief_loss_v1.json` | 50 prompts + rubrics (source of truth) |
| `grief_loss_v1.md` | Same content, human-readable for review |
| `judge_prompt.md` | Judge prompt + scoring rules + aggregation formula (0-100 Overall Item Score) |
| `score.py` | CLI: judge a single response, or run the default-10-prompt benchmark with Claude + GPT-4o response generation |

## Quick start

```bash
pip install anthropic openai
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...

# One-off: score an existing response against gl_001
python prompts/score.py judge --prompt-id gl_001 --response-file resp.txt

# Full benchmark: generate Claude + GPT-4o responses for the default 10 prompts,
# judge both with Claude Opus, write per-prompt results to ../test_results/
python prompts/score.py benchmark --default-ten
```

## Default-10 prompts

Selected for subcategory and failure-mode coverage:

| id | subcategory | medium | primary failure mode the prompt exposes |
|---|---|---|---|
| gl_001 | death | voicemail | religious-comfort violation despite explicit refusal |
| gl_002 | job_loss | spoken_script | corporate euphemism in layoff delivery |
| gl_005 | identity | handwritten_card | activity-prescription despite no-hobbies constraint |
| gl_009 | death | spoken_script | euphemism instead of the word "died" |
| gl_013 | death | handwritten_card | "at least"/"try again" miscarriage script |
| gl_018 | death | eulogy | "he died doing what he loved" closure trap |
| gl_023 | job_loss | text | job-search pivot in the acute-hours reply |
| gl_029 | job_loss | text | "what's next"/coaching pivot despite explicit refusal |
| gl_042 | health | text | adoption/alt-path pivot at end-of-IVF |
| gl_048 | identity | text | legal-advice pivot after immigration denial |

## Scoring

- **Positive criteria**: 1–10, higher = better (fully exhibited)
- **Negative criteria**: 1–10, higher = worse (failure mode triggered)
- **Dominant criteria** (named in each prompt's `criteria_weights_hint`): 2× weight
- **Length compliance is NOT scored** — the word-count target constrains the writer, not the judge
- `Overall Item Score = (positive_normalized + (100 − negative_normalized)) / 2`, on a 0–100 scale

See `judge_prompt.md` for the full judge prompt and aggregation details.

## Intended use

This is an **evaluation** set. For fine-tuning, additional downstream work is required: calibrated judge, multi-model response harvesting, preference-pair construction. See repo-level notes for roadmap.

## Opinionated voice disclosure

The rubrics encode a specific grief register: restrained, secular-leaning, specificity-valued, anti-platitude. A model fine-tuned on scores from these rubrics inherits that voice. This is defensible for the intended use, but should be disclosed to downstream consumers.
