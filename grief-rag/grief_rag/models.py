from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Scenario:
    id: str
    description: str
    responses: dict[str, str] = field(default_factory=dict)
    rankings: Optional[dict[str, int]] = None

    def __post_init__(self) -> None:
        if self.rankings:
            unknown = set(self.rankings) - set(self.responses)
            if unknown:
                raise ValueError(
                    f"rankings keys not found in responses: {unknown}"
                )

    def top_responses(self, n: int = 2) -> list[str]:
        """Return response texts ranked 1..n, or all responses if unranked."""
        if not self.rankings:
            return list(self.responses.values())
        ranked = sorted(self.rankings.items(), key=lambda x: x[1])
        return [self.responses[k] for k, _ in ranked[:n] if k in self.responses]
