import sys
from pathlib import Path
from grief_rag.parse import parse_file
from grief_rag.enrich import enrich_scenarios
from grief_rag.index import build_index, save_index, load_index, search
from grief_rag.query import build_context_block, generate_response
from grief_rag.load_rankings import load_rankings, apply_rankings

DATASET_PATH = Path("/Users/SPARSH/Downloads/grief_loss_dataset.md")
INDEX_PATH = Path("/Users/SPARSH/grief-rag/grief_index.npz")
RANKINGS_PATH = Path("/Users/SPARSH/grief-rag/rankings.json")


def get_or_build_index():
    scenarios = parse_file(DATASET_PATH)
    if RANKINGS_PATH.exists():
        apply_rankings(scenarios, load_rankings(RANKINGS_PATH))
        print("Rankings loaded.")
    scenario_map = {s.id: s for s in scenarios}

    if INDEX_PATH.exists():
        print("Loading existing index...")
        matrix, ids = load_index(INDEX_PATH)
    else:
        print("Building index (first run, may take ~30s)...")
        ids = [s.id for s in scenarios]
        documents = enrich_scenarios(scenarios)
        # ids and documents are built from the same ordered list — positional alignment is guaranteed
        assert len(ids) == len(documents), "enrich_scenarios must return one doc per scenario"
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
    context_block = build_context_block(top_ids, scenario_map)

    print("Generating response...\n")
    response = generate_response(situation=situation, context_block=context_block)
    print("=" * 60)
    print(response)
    print("=" * 60)


if __name__ == "__main__":
    main()
