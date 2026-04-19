from grief_rag.models import Scenario
import pytest


def test_post_init_raises_on_unknown_ranking_key():
    with pytest.raises(ValueError, match="rankings keys not found"):
        Scenario(
            id="gl_001",
            description="test",
            responses={"A": "resp_a"},
            rankings={"Z": 1},
        )


def test_top_responses_with_rankings():
    s = Scenario(
        id="gl_001",
        description="test",
        responses={"A": "resp_a", "B": "resp_b", "C": "resp_c"},
        rankings={"A": 2, "B": 1, "C": 3},
    )
    assert s.top_responses(2) == ["resp_b", "resp_a"]


def test_top_responses_unranked_returns_all():
    s = Scenario(
        id="gl_001",
        description="test",
        responses={"A": "resp_a", "B": "resp_b"},
        rankings=None,
    )
    assert set(s.top_responses()) == {"resp_a", "resp_b"}
