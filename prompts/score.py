#!/usr/bin/env python3
"""
grief_loss_v1 scoring harness.

Given a prompt_id and a response, calls a Claude judge with the scenario-specific
rubric and emits an EQ-Bench-style scored table with Overall Item Score 0-100.

Also supports generating responses from Claude and/or GPT-4o for a prompt, then
judging both, which is how the initial 10-prompt benchmark is run.

Usage:

  # 1. Score an existing response against a prompt
  python score.py judge --prompt-id gl_001 --response-file resp.txt
  python score.py judge --prompt-id gl_001 --response "..."

  # 2. Generate responses from Claude + GPT-4o, then judge both
  python score.py benchmark --prompt-id gl_001
  python score.py benchmark --prompt-ids gl_001 gl_002 gl_003 ...

  # 3. Run the default 10-prompt benchmark
  python score.py benchmark --default-ten

Env:
  ANTHROPIC_API_KEY   required (for judge; also for Claude responses)
  OPENAI_API_KEY      required for GPT-4o responses
  JUDGE_MODEL         default: claude-opus-4-5-20250929
  CLAUDE_RESP_MODEL   default: claude-sonnet-4-5-20250929
  OPENAI_RESP_MODEL   default: gpt-4o

Install:
  pip install anthropic openai
"""

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUBRIC_PATH = HERE / "grief_loss_v1.json"

DEFAULT_TEN = [
    "gl_001",  # voicemail, suicide, close friend, explicit no-religious constraint
    "gl_002",  # spoken script, manager layoff, corporate euphemism trap
    "gl_005",  # handwritten card, forced retirement, explicit no-hobbies constraint
    "gl_009",  # medical news-delivery script, word "died"
    "gl_013",  # miscarriage card, explicit no-at-least/no-own-kids constraints
    "gl_018",  # eulogy, "died doing what he loved" trap
    "gl_023",  # acute text, layoff, no-job-search trap
    "gl_029",  # athlete career-ending, explicit no-what's-next constraint
    "gl_042",  # text, failed IVF, no-alternative-path trap
    "gl_048",  # text, immigration denial, no-legal-pivot trap
]

DEFAULT_JUDGE_MODEL = os.getenv("JUDGE_MODEL", "claude-opus-4-5-20250929")
DEFAULT_CLAUDE_RESP_MODEL = os.getenv("CLAUDE_RESP_MODEL", "claude-sonnet-4-5-20250929")
DEFAULT_OPENAI_RESP_MODEL = os.getenv("OPENAI_RESP_MODEL", "gpt-4o")


def load_rubric(prompt_id: str) -> dict:
    data = json.loads(RUBRIC_PATH.read_text())
    for d in data:
        if d["id"] == prompt_id:
            return d
    raise SystemExit(f"prompt_id {prompt_id!r} not found in {RUBRIC_PATH.name}")


def build_judge_prompt(rubric: dict, response_text: str) -> str:
    pos = "\n".join(f"- {c}" for c in rubric["scoring_criteria_positive"])
    neg = "\n".join(f"- {c}" for c in rubric["scoring_criteria_negative"])
    return f"""You are an expert evaluator of emotionally intelligent writing. You will score an LLM's response to a grief and loss scenario against a scenario-specific rubric. Be strict and literal. Specificity matters more than polish.

## The scenario
{rubric['prompt_text']}

## The response to evaluate
{response_text}

## Rubric — positive criteria (reward; 1=absent, 10=fully exhibited)
{pos}

## Rubric — negative criteria (penalize; 1=absent, 10=severely exhibited)
{neg}

## Weights hint for this scenario
{rubric['criteria_weights_hint']}

## Scoring rules
1. Identify 2-3 dominant criteria from the weights hint. Score these FIRST, before the rest.
2. Assign a 1-10 integer to every positive and every negative criterion.
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
"""


def get_claude_response(rubric: dict, model: str = DEFAULT_CLAUDE_RESP_MODEL) -> str:
    from anthropic import Anthropic
    client = Anthropic()
    msg = client.messages.create(
        model=model,
        max_tokens=1000,
        messages=[{"role": "user", "content": rubric["prompt_text"]}],
    )
    return msg.content[0].text.strip()


def get_openai_response(rubric: dict, model: str = DEFAULT_OPENAI_RESP_MODEL) -> str:
    from openai import OpenAI
    client = OpenAI()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": rubric["prompt_text"]}],
        max_tokens=1000,
    )
    return resp.choices[0].message.content.strip()


def judge(rubric: dict, response_text: str, model: str = DEFAULT_JUDGE_MODEL) -> str:
    from anthropic import Anthropic
    client = Anthropic()
    prompt = build_judge_prompt(rubric, response_text)
    msg = client.messages.create(
        model=model,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def cmd_judge(args):
    rubric = load_rubric(args.prompt_id)
    if args.response:
        resp = args.response
    elif args.response_file:
        resp = Path(args.response_file).read_text()
    else:
        resp = sys.stdin.read()
    print(judge(rubric, resp, model=args.model))


def cmd_benchmark(args):
    ids = args.prompt_ids or (DEFAULT_TEN if args.default_ten else [args.prompt_id])
    out_dir = HERE.parent / "test_results"
    out_dir.mkdir(exist_ok=True)

    for pid in ids:
        rubric = load_rubric(pid)
        print(f"\n=== {pid} — {rubric['subcategory']} / {rubric['medium']} ===", flush=True)
        results = {"prompt_id": pid, "responses": {}, "scores": {}}

        for model_label, getter in [
            ("claude", get_claude_response),
            ("gpt-4o", get_openai_response),
        ]:
            try:
                print(f"  generating {model_label} response...", flush=True)
                resp = getter(rubric)
                print(f"  judging {model_label} response...", flush=True)
                scored = judge(rubric, resp, model=args.judge_model)
                results["responses"][model_label] = resp
                results["scores"][model_label] = scored
            except Exception as e:
                print(f"  {model_label} failed: {e}", flush=True)
                results["responses"][model_label] = f"ERROR: {e}"
                results["scores"][model_label] = None

        out_file = out_dir / f"{pid}.md"
        out_file.write_text(format_result_markdown(rubric, results))
        print(f"  wrote {out_file}", flush=True)


def format_result_markdown(rubric: dict, results: dict) -> str:
    lines = [f"# {rubric['id']} — {rubric['cause_or_context']}\n"]
    lines.append(f"**Subcategory:** {rubric['subcategory']} · **Medium:** {rubric['medium']} · **Word count:** {rubric['word_count_target']}\n")
    lines.append(f"## Scenario\n\n> {rubric['prompt_text']}\n")
    for model_label in ("claude", "gpt-4o"):
        lines.append(f"---\n\n## {model_label} response\n")
        lines.append(f"```\n{results['responses'].get(model_label, '(missing)')}\n```\n")
        lines.append(f"## {model_label} judge output\n")
        lines.append(f"```\n{results['scores'].get(model_label, '(missing)')}\n```\n")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    j = sub.add_parser("judge", help="Score a single response against a rubric")
    j.add_argument("--prompt-id", required=True)
    j.add_argument("--response")
    j.add_argument("--response-file")
    j.add_argument("--model", default=DEFAULT_JUDGE_MODEL)
    j.set_defaults(func=cmd_judge)

    b = sub.add_parser("benchmark", help="Generate Claude + GPT-4o responses and judge both")
    b.add_argument("--prompt-id")
    b.add_argument("--prompt-ids", nargs="+")
    b.add_argument("--default-ten", action="store_true")
    b.add_argument("--judge-model", default=DEFAULT_JUDGE_MODEL)
    b.set_defaults(func=cmd_benchmark)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
