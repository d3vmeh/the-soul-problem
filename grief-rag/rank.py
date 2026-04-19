"""
Run once to rank all scenario responses by emotional intelligence.
Writes rankings.json to the project root.

Usage:
    ANTHROPIC_API_KEY=... python rank.py
"""
import json
import time
from pathlib import Path

import anthropic

from grief_rag.parse import parse_file

DATASET_PATH = Path("/Users/SPARSH/Downloads/grief_loss_dataset.md")
RANKINGS_PATH = Path("/Users/SPARSH/grief-rag/rankings.json")

RANK_PROMPT = """\
You are evaluating grief and loss support responses for emotional intelligence.

Situation: {description}

Rank the following responses from 1 (most emotionally intelligent) to {n} (least), based on:
- Specificity — no generic platitudes, addresses this situation directly
- No unsolicited advice, silver linings, or reframing
- Concrete commitment ("I'll call Sunday") rather than vague availability ("I'm here for you")
- Does not center the speaker's feelings
- Holds space for ambiguity — does not resolve what cannot be resolved

Responses:
{responses}

Reply with ONLY valid JSON in this exact format — no explanation, no markdown:
{{"rankings": {{"A": 1, "B": 3, ...}}}}

Every response letter must appear exactly once. Ranks must be 1 through {n} with no ties."""


def rank_scenario(scenario, client: anthropic.Anthropic) -> dict[str, int]:
    letters = sorted(scenario.responses.keys())
    response_block = "\n".join(
        f"{letter}: {scenario.responses[letter][:300]}{'...' if len(scenario.responses[letter]) > 300 else ''}"
        for letter in letters
    )
    prompt = RANK_PROMPT.format(
        description=scenario.description,
        n=len(letters),
        responses=response_block,
    )
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
    if raw.endswith("```"):
        raw = "\n".join(raw.split("\n")[:-1])
    raw = raw.strip()
    # Use raw_decode to handle trailing content after the first JSON object
    data, _ = json.JSONDecoder().raw_decode(raw)
    rankings = {k: int(v) for k, v in data["rankings"].items()}

    # Validate
    expected = set(letters)
    if set(rankings.keys()) != expected:
        raise ValueError(f"{scenario.id}: unexpected keys {set(rankings.keys())} vs {expected}")
    # Break ties by assigning unique ranks in letter order
    if len(set(rankings.values())) < len(rankings):
        sorted_by_rank = sorted(rankings.items(), key=lambda x: (x[1], x[0]))
        rankings = {k: i + 1 for i, (k, _) in enumerate(sorted_by_rank)}
    if sorted(rankings.values()) != list(range(1, len(letters) + 1)):
        raise ValueError(f"{scenario.id}: ranks not 1..{len(letters)}: {rankings}")

    return rankings


def main():
    client = anthropic.Anthropic()
    scenarios = parse_file(DATASET_PATH)
    print(f"Ranking {len(scenarios)} scenarios...")

    results = {}
    for i, s in enumerate(scenarios, 1):
        try:
            rankings = rank_scenario(s, client)
            results[s.id] = rankings
            best = min(rankings, key=rankings.get)
            print(f"  [{i:02d}/{len(scenarios)}] {s.id} — best: Response {best}")
        except Exception as e:
            print(f"  [{i:02d}/{len(scenarios)}] {s.id} — ERROR: {e}")
            results[s.id] = None
        time.sleep(0.2)  # gentle rate limiting

    RANKINGS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nDone. Rankings saved to {RANKINGS_PATH}")
    failed = [k for k, v in results.items() if v is None]
    if failed:
        print(f"Failed scenarios: {failed}")


if __name__ == "__main__":
    main()
