import json
from pathlib import Path
from typing import Dict, List, Optional

from .models import Scenario


def load_optimal_responses(path: Path) -> Dict[str, List[str]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {k: [r for r in v if r.strip()] for k, v in data.items()}


def apply_optimal_responses(scenarios: list, optimal: Dict[str, List[str]]) -> None:
    """Replace each scenario's responses with only the optimal ones, if provided."""
    for s in scenarios:
        if s.id in optimal and optimal[s.id]:
            s.responses = {str(i + 1): r for i, r in enumerate(optimal[s.id])}
            s.rankings = None  # no ranking needed — all responses are optimal
