import json
from pathlib import Path
from typing import Dict, Optional

from .models import Scenario


def load_rankings(path: Path) -> Dict[str, Optional[Dict[str, int]]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {
        scenario_id: (
            {k: int(v) for k, v in rankings.items()} if rankings else None
        )
        for scenario_id, rankings in data.items()
    }


def apply_rankings(scenarios: list, rankings: Dict[str, Optional[Dict[str, int]]]) -> None:
    for s in scenarios:
        if s.id in rankings and rankings[s.id] is not None:
            s.rankings = rankings[s.id]
