import Anthropic from '@anthropic-ai/sdk';

const PROMPT_TEMPLATE = `You are an expert evaluator of emotionally intelligent writing. You will score an LLM or human response to a grief and loss scenario against a scenario-specific rubric. Be STRICT. Prioritize specificity over polish. Prioritize restraint over fluency.

## The scenario
{{SCENARIO_PROMPT}}

## The response to evaluate
{{RESPONSE}}

## Rubric — positive criteria (reward; 1=absent, 10=fully exhibited)
{{POSITIVE_CRITERIA}}

## Rubric — negative criteria (penalize; 1=absent, 10=severely exhibited)
{{NEGATIVE_CRITERIA}}

## Weights hint for this scenario
{{WEIGHTS_HINT}}

## Calibration — read this before scoring

**The distribution of scores should be roughly normal around 5-7.**

- A **10** on any positive is RARE. It requires exceptional, unambiguous, specific fulfillment — not just meeting the criterion, but meeting it with craft and resonance. If you're giving 10s casually, stop and re-read.
- A **1** on any negative is also RARE. It requires total, unambiguous absence with no faint trace of the failure mode.
- Competent, conventional fulfillment of a criterion is a **6 or 7**, not a 9.
- The LLM-template look — safe, symmetrical, competent — typically scores **5-7 on positives** because it checks boxes without landing.
- A **perfect response** (all positives at 10, all negatives at 1, yielding ~100/100) is essentially impossible for real writing. If you computed that, you failed to find subtle weaknesses. Find them.
- **When in doubt, score lower, not higher.** Err on the side of strictness.

## Scoring anchors

**Positive criteria:**
- 10: Exceptional — specific, original, resonant. One detail that could only belong to this response. Almost never awarded.
- 8-9: Strong — clear, concrete fulfillment with specific evidence in the text.
- 6-7: Adequate — meets the criterion in a conventional, template-friendly way.
- 4-5: Partial — gestures at the criterion but doesn't fully land.
- 1-3: Largely absent; generic or missing.

**Negative criteria:**
- 10: Severe — fully exhibits the failure mode, central to the response.
- 7-9: Significant — clear presence, multiple instances or central tone.
- 4-6: Partial — some traces; softer form of the failure.
- 2-3: Minor — a faint echo, a single line that glances at the failure.
- 1: Truly absent. No trace at all, not even a hedged phrase.

## Scoring rules
1. Identify 2-3 dominant criteria from the weights hint. Score these FIRST.
2. For EVERY criterion, cite ONE specific phrase or absence from the response that drove the score. If you cannot, score more conservatively (closer to the middle).
3. Assign a 1-10 integer to every positive and every negative criterion.
4. Dominant criteria count with 2x weight in the aggregation.
5. Do NOT score length compliance.
6. Do NOT invent criteria. Do NOT skip criteria. Use the bullets as given.
7. Base every score on the response itself. No guessing intent. No credit for what the writer "might have meant".

## Output format (exact — no preamble, no trailing commentary)

## Dominant criteria (2x weight)
- <short label derived from first clause of criterion>
- <short label>
(- optional third)

## Positive scores
<short label>: <1-10>
<short label>: <1-10>
...

## Negative scores
<short label>: <1-10>
<short label>: <1-10>
...

## Aggregation
Positive raw: <int>
Positive max: <int>
Negative raw: <int>
Negative max: <int>
Positive normalized: <float, 2 decimals>
Negative normalized: <float, 2 decimals>

Overall Item Score: <float, 2 decimals> / 100

## Rationale
<one sentence — the single strongest reason this response landed where it did. Name the criterion and quote or paraphrase one specific phrase from the response.>
`;

export type ScenarioForJudge = {
  prompt: string;
  metadata: {
    scoring_criteria_positive: string[];
    scoring_criteria_negative: string[];
    criteria_weights_hint: string;
  };
};

export type JudgeResult = {
  overall_score: number;
  dominant_criteria: string[];
  positive_scores: Record<string, number>;
  negative_scores: Record<string, number>;
  aggregation: {
    positive_raw: number;
    positive_max: number;
    negative_raw: number;
    negative_max: number;
    positive_normalized: number;
    negative_normalized: number;
  };
  rationale: string;
  raw_output: string;
};

function buildPrompt(scenario: ScenarioForJudge, responseText: string): string {
  const pos = scenario.metadata.scoring_criteria_positive.map(c => `- ${c}`).join('\n');
  const neg = scenario.metadata.scoring_criteria_negative.map(c => `- ${c}`).join('\n');
  return PROMPT_TEMPLATE
    .replace('{{SCENARIO_PROMPT}}', scenario.prompt)
    .replace('{{RESPONSE}}', responseText)
    .replace('{{POSITIVE_CRITERIA}}', pos)
    .replace('{{NEGATIVE_CRITERIA}}', neg)
    .replace('{{WEIGHTS_HINT}}', scenario.metadata.criteria_weights_hint);
}

function parseScoreLines(section: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('##')) continue;
    const match = trimmed.match(/^(.+?):\s*(\d+)\s*$/);
    if (!match) continue;
    scores[match[1].trim()] = parseInt(match[2], 10);
  }
  return scores;
}

export function parseJudgment(raw: string): JudgeResult {
  const sections: Record<string, string> = {};
  const blocks = raw.split(/^##\s+/m).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const [header, ...rest] = block.split('\n');
    sections[header.trim().toLowerCase()] = rest.join('\n').trim();
  }

  const dominantSection =
    sections['dominant criteria (2x weight)'] ??
    sections['dominant criteria (2× weight)'] ??
    '';
  const dominant_criteria = dominantSection
    .split('\n')
    .map(l => l.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);

  const positive_scores = parseScoreLines(sections['positive scores'] ?? '');
  const negative_scores = parseScoreLines(sections['negative scores'] ?? '');

  const aggText = sections['aggregation'] ?? '';
  const getNum = (label: string): number => {
    const line = aggText.split('\n').find(l => l.toLowerCase().startsWith(label.toLowerCase() + ':'));
    if (!line) return 0;
    const nums = [...line.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
    return nums.length ? nums[nums.length - 1] : 0;
  };
  const aggregation = {
    positive_raw: getNum('Positive raw'),
    positive_max: getNum('Positive max'),
    negative_raw: getNum('Negative raw'),
    negative_max: getNum('Negative max'),
    positive_normalized: getNum('Positive normalized'),
    negative_normalized: getNum('Negative normalized'),
  };

  const overallLine = raw.match(/Overall Item Score:[^\n]*/i)?.[0] ?? '';
  const slashMatch = overallLine.match(/(-?\d+(?:\.\d+)?)\s*\/\s*100\b/);
  let overall_score = slashMatch ? parseFloat(slashMatch[1]) : 0;
  if (!slashMatch) {
    const nums = [...overallLine.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
    if (nums.length) overall_score = nums[nums.length - 1];
  }

  const rationale = (sections['rationale'] ?? '').trim();

  return { dominant_criteria, positive_scores, negative_scores, aggregation, overall_score, rationale, raw_output: raw };
}

export async function judgeResponse(
  scenario: ScenarioForJudge,
  responseText: string,
  judgeModel = 'claude-sonnet-4-6'
): Promise<JudgeResult> {
  const anthropic = new Anthropic();
  const prompt = buildPrompt(scenario, responseText);
  const res = await anthropic.messages.create({
    model: judgeModel,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  const raw = block.type === 'text' ? block.text : '';
  return parseJudgment(raw);
}
