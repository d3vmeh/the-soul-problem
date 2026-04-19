from grief_rag.parse import parse_dataset

SAMPLE_MD = """
## gl_001 — spouse's suicide, stigmatized grief

### Response A
Hey. It's me. I know you probably won't pick up.

### Response B
It's me. Just calling to say I'm thinking about you.

---

## gl_002 — involuntary layoff, direct report

### Response A
Priya, I need to tell you something hard.

### Response B
Priya, I want to talk to you about something difficult.

---
"""


def test_parse_returns_two_scenarios():
    scenarios = parse_dataset(SAMPLE_MD)
    assert len(scenarios) == 2


def test_parse_scenario_id_and_description():
    scenarios = parse_dataset(SAMPLE_MD)
    assert scenarios[0].id == "gl_001"
    assert scenarios[0].description == "spouse's suicide, stigmatized grief"


def test_parse_responses():
    scenarios = parse_dataset(SAMPLE_MD)
    assert "A" in scenarios[0].responses
    assert "B" in scenarios[0].responses
    assert "Hey. It's me." in scenarios[0].responses["A"]


def test_parse_rankings_none_by_default():
    scenarios = parse_dataset(SAMPLE_MD)
    assert scenarios[0].rankings is None
