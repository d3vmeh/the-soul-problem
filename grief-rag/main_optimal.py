"""
Variant of main.py that uses human-curated optimal responses as RAG context.
Fill in optimal_responses.json before running.

Usage:
    ANTHROPIC_API_KEY=... python main_optimal.py "describe the situation"
"""
import sys
from pathlib import Path
from grief_rag.parse import parse_file
from grief_rag.enrich import enrich_scenarios
from grief_rag.index import build_index, save_index, load_index, search
from grief_rag.query import build_context_block, generate_response
from grief_rag.load_optimal import load_optimal_responses, apply_optimal_responses
from grief_rag.load_rankings import load_rankings, apply_rankings

DATASET_PATH = Path("/Users/SPARSH/Downloads/grief_loss_dataset.md")
INDEX_PATH = Path("/Users/SPARSH/grief-rag/optimal_index.npz")
OPTIMAL_PATH = Path("/Users/SPARSH/grief-rag/optimal_responses.json")
RANKINGS_PATH = Path("/Users/SPARSH/grief-rag/rankings.json")
MODEL = "claude-sonnet-4-6"


def get_or_build_index():
    scenarios = parse_file(DATASET_PATH)
    # Apply rankings first (fallback for scenarios without optimal responses)
    if RANKINGS_PATH.exists():
        apply_rankings(scenarios, load_rankings(RANKINGS_PATH))
    # Then overlay optimal responses where available (overrides rankings)
    optimal = load_optimal_responses(OPTIMAL_PATH)
    apply_optimal_responses(scenarios, optimal)
    filled = sum(1 for sid, v in optimal.items() if v)
    print(f"Optimal responses loaded: {filled}/50 scenarios. Remaining use ranked fallback.")
    scenario_map = {s.id: s for s in scenarios}

    if INDEX_PATH.exists():
        print("Loading existing optimal index...")
        matrix, ids = load_index(INDEX_PATH)
    else:
        print("Building optimal index (first run, may take ~30s)...")
        documents = enrich_scenarios(scenarios)
        ids = [s.id for s in scenarios]
        assert len(ids) == len(documents)
        matrix, ids = build_index(documents, ids)
        save_index(matrix, ids, INDEX_PATH)
        print(f"Index saved to {INDEX_PATH}")

    return matrix, ids, scenario_map


def main():
    matrix, ids, scenario_map = get_or_build_index()

    situation = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None
    if not situation:
        print("\nDescribe the grief situation (Ctrl+C to quit):")
        try:
            situation = input("> ").strip()
        except KeyboardInterrupt:
            print()
            return

    if not situation:
        print("No situation provided.")
        return

    print("\nRetrieving relevant examples...")
    top_ids = search(situation, matrix, ids, top_k=3)

    # Only include scenarios that have optimal responses
    top_ids_with_responses = [sid for sid in top_ids if scenario_map[sid].responses]
    if not top_ids_with_responses:
        print("No optimal responses available yet for retrieved scenarios.")
        print("Fill in optimal_responses.json and re-run.")
        return

    context_block = build_context_block(top_ids_with_responses, scenario_map)

    print("Generating response...\n")
    response = generate_response(
        situation=situation,
        context_block=context_block,
        model=MODEL,
    )
    print("=" * 60)
    print(response)
    print("=" * 60)


if __name__ == "__main__":
    main()
