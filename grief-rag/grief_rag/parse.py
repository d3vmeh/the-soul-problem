import re
from pathlib import Path
from typing import Union, List

from .models import Scenario


def parse_dataset(text: str) -> List[Scenario]:
    """Parse markdown dataset into list of Scenario objects.

    Expected format:
    ## gl_001 — description
    ### Response A
    text...
    ### Response B
    text...
    ---
    """
    scenarios = []
    # Split on h2 scenario headers: ## gl_NNN — description
    blocks = re.split(r"(?m)^## (gl_\d+) — (.+)$", text)
    # blocks[0] is pre-header content; then triplets of (id, description, body)
    i = 1
    while i + 2 < len(blocks):
        scenario_id = blocks[i].strip()
        description = blocks[i + 1].strip()
        body = blocks[i + 2]
        responses = _parse_responses(body)
        scenarios.append(
            Scenario(id=scenario_id, description=description, responses=responses)
        )
        i += 3
    return scenarios


def _parse_responses(body: str) -> dict[str, str]:
    """Parse response sections from scenario body.

    Expected format:
    ### Response A
    text...
    ### Response B
    text...
    ---
    """
    responses = {}
    # The dataset uses response letters A–E only; letters outside this range are ignored.
    parts = re.split(r"(?m)^### Response ([A-E])$", body)
    # parts[0] is pre-first-response content; then pairs of (letter, text)
    i = 1
    while i + 1 < len(parts):
        letter = parts[i].strip()
        text = parts[i + 1].strip()
        # Stop at the --- separator (must be surrounded by newlines)
        text = text.split("\n---\n")[0].strip()
        if text:
            responses[letter] = text
        i += 2
    return responses


def parse_file(path: Union[str, Path]) -> List[Scenario]:
    """Parse a markdown file into list of Scenario objects."""
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise FileNotFoundError(f"grief dataset not found: {path}")
    except PermissionError:
        raise PermissionError(f"cannot read grief dataset: {path}")
    return parse_dataset(text)
