import Anthropic from '@anthropic-ai/sdk';

const PROMPT_TEMPLATE = `You are an expert evaluator of emotionally intelligent writing. You will score an LLM's response to a grief and loss scenario against a scenario-specific rubric. Be strict and literal. Specificity matters more than polish.

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

## Scoring rules
1. Identify 2-3 dominant criteria from the weights hint. Score these FIRST, before the rest.
2. Assign a 1-10 integer to every positive and every negative criterion.
3. Dominant criteria count with 2x weight in the aggregation.
4. Do NOT score length compliance.
5. Do NOT invent criteria. Do NOT skip criteria. Use the bullets as given.
6. Base every score on the response itself. No guessing intent.

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
<one sentence — the strongest reason this response landed where it did, referencing one specific criterion by label>
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
