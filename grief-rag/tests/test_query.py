from unittest.mock import MagicMock, patch
from grief_rag.models import Scenario
from grief_rag.query import build_context_block, generate_response

SCENARIOS = {
    "gl_001": Scenario(
        id="gl_001",
        description="spouse's suicide, stigmatized grief",
        responses={"A": "Hey. I was there.", "B": "It's me. I'll call Sunday.", "C": "He was wonderful."},
        rankings={"B": 1, "A": 2, "C": 3},
    ),
    "gl_002": Scenario(
        id="gl_002",
        description="involuntary layoff, direct report",
        responses={"A": "Priya, this is hard news.", "B": "Priya, the company is restructuring."},
        rankings=None,
    ),
}


def test_build_context_block_uses_top_ranked():
    block = build_context_block(["gl_001"], SCENARIOS)
    # Top 2 ranked: B (rank 1), A (rank 2) — C (rank 3) excluded
    assert "I'll call Sunday" in block
    assert "I was there" in block
    assert "He was wonderful" not in block


def test_build_context_block_unranked_includes_all():
    block = build_context_block(["gl_002"], SCENARIOS)
    assert "hard news" in block
    assert "restructuring" in block


def test_build_context_block_includes_scenario_label():
    block = build_context_block(["gl_001"], SCENARIOS)
    assert "gl_001" in block
    assert "spouse's suicide" in block


def test_generate_response_calls_claude():
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="I'll be there Thursday.")]
    )
    result = generate_response(
        situation="My friend just lost her mother suddenly.",
        context_block="[gl_001: ...]\n— 'Hey. I was there.'",
        client=mock_client,
    )
    assert result == "I'll be there Thursday."
    mock_client.messages.create.assert_called_once()
