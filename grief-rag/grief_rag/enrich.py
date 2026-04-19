from typing import List, Optional
import anthropic
from .models import Scenario


def build_document(scenario: Scenario, tone_summary: Optional[str] = None) -> str:
    """Build an embeddable document string from a scenario."""
    doc = f"{scenario.id}: {scenario.description}"
    if tone_summary:
        doc += f" | tone: {tone_summary}"
    return doc


def build_tone_summary(scenario: Scenario, client: Optional[anthropic.Anthropic] = None) -> str:
    """Ask Claude to summarise what the top-ranked responses do well in 5-10 words."""
    if not scenario.rankings:
        return ""
    top_texts = scenario.top_responses(n=2)
    if not top_texts:
        return ""
    client = client or anthropic.Anthropic()
    joined = "\n\n".join(top_texts)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=40,
        messages=[
            {
                "role": "user",
                "content": (
                    f"In 5-10 words, describe what makes these grief responses emotionally intelligent. "
                    f"Reply with only the description, no punctuation at the end.\n\n{joined}"
                ),
            }
        ],
    )
    return message.content[0].text.strip()


def enrich_scenarios(
    scenarios: List[Scenario], client: Optional[anthropic.Anthropic] = None
) -> List[str]:
    """Return one embeddable document string per scenario."""
    documents = []
    for s in scenarios:
        tone = build_tone_summary(s, client) if s.rankings else None
        documents.append(build_document(s, tone))
    return documents
