from typing import Optional, Dict, List
import anthropic
from .models import Scenario

SYSTEM_PROMPT = """You are helping someone craft an emotionally intelligent response to a grief or loss situation. You have been given examples of high-quality responses as context.

What makes these responses work:
- They are specific to the situation, not generic
- They do not offer unsolicited advice or silver linings
- They make a concrete commitment ("I'll call Sunday") rather than vague availability ("I'm here for you")
- They do not center the speaker's feelings
- They hold space for ambiguity — they don't resolve what can't be resolved
- They match the register of the relationship (text vs email vs voicemail)

Use the examples as a model for tone, specificity, and restraint.
Write ONE ready-to-send message. Do not explain it."""


def build_context_block(scenario_ids: List[str], scenarios: Dict[str, Scenario]) -> str:
    lines = []
    for sid in scenario_ids:
        s = scenarios.get(sid)
        if not s:
            continue
        lines.append(f"[{s.id}: {s.description}]")
        for text in s.top_responses(n=2):
            lines.append(f'— "{text}"')
        lines.append("")
    return "\n".join(lines).strip()


def generate_response(
    situation: str,
    context_block: str,
    client: Optional[anthropic.Anthropic] = None,
    model: str = "claude-sonnet-4-6",
) -> str:
    client = client or anthropic.Anthropic()
    user_prompt = f"Situation: {situation}\n\nExamples:\n{context_block}\n\nWrite the response."
    message = client.messages.create(
        model=model,
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return message.content[0].text.strip()
