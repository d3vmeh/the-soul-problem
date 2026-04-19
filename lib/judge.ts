import Anthropic from '@anthropic-ai/sdk';

const PROMPT_TEMPLATE = `You are an expert evaluator of emotionally intelligent writing. You will score a response to a grief and loss scenario against a scenario-specific rubric. Be STRICT. Prioritize specificity over polish. Prioritize restraint over fluency.

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

- A **10** on any positive is RARE. It requires exceptional, unambiguous, specific fulfillment — not just meeting the criterion, but meeting it with craft and resonance.
- A **1** on any negative is also RARE. It requires total, unambiguous absence with no faint trace of the failure mode.
- Competent, conventional fulfillment of a criterion is a **6 or 7**, not a 9.
- The LLM-template look — safe, symmetrical, competent — typically scores **5-7 on positives** because it checks boxes without landing.
- **When in doubt, score lower, not higher.**

## Scoring anchors

**Positive criteria:** 10=exceptional (rare); 8-9=strong with specific evidence; 6-7=adequate/template; 4-5=partial; 1-3=largely absent.

**Negative criteria:** 10=severe/central; 7-9=significant; 4-6=partial traces; 2-3=faint echo; 1=truly absent.

## Scoring rules

1. Identify 2-3 dominant criteria from the weights hint — use short labels (first clause of the criterion).
2. Score EVERY positive and EVERY negative criterion as an integer 1-10. Do not skip any. Use the short label (first clause) as the key.
3. For every score, base your judgment on specific evidence in the response.
4. Do NOT score length compliance.
5. No credit for what the writer "might have meant".

Submit your evaluation via the submit_rubric_evaluation tool. The overall score is computed deterministically from your per-criterion scores — do not compute it yourself.
`;

const JUDGE_TOOL = {
  name: 'submit_rubric_evaluation',
  description: 'Submit the per-criterion rubric evaluation for the response under review.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dominant_criteria: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 3,
        description: 'Short labels (first clause) of the 2-3 criteria identified from the weights hint as dominant. These count 2x in aggregation.',
      },
      positive_scores: {
        type: 'object',
        additionalProperties: { type: 'integer', minimum: 1, maximum: 10 },
        description: 'Map of positive criterion short label → 1-10 score. Every positive criterion must appear.',
      },
      negative_scores: {
        type: 'object',
        additionalProperties: { type: 'integer', minimum: 1, maximum: 10 },
        description: 'Map of negative criterion short label → 1-10 score. Every negative criterion must appear.',
      },
      rationale: {
        type: 'string',
        description: 'One sentence: the single strongest reason this response landed where it did, naming one criterion and quoting or paraphrasing one specific phrase from the response.',
      },
    },
    required: ['dominant_criteria', 'positive_scores', 'negative_scores', 'rationale'],
  },
};

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

function matchesDominant(label: string, dominants: string[]): boolean {
  const l = label.toLowerCase().trim();
  return dominants.some(d => {
    const dl = d.toLowerCase().trim();
    if (!dl) return false;
    return l === dl || l.includes(dl) || dl.includes(l);
  });
}

// Compute overall deterministically from per-criterion scores. We never trust the
// judge's own arithmetic — judges have been observed to invent formulas, use 0-1
// fractions instead of percents, or write numbers inside markdown that breaks regexes.
export function computeAggregation(
  positive: Record<string, number>,
  negative: Record<string, number>,
  dominants: string[]
) {
  let posRaw = 0, posMax = 0, negRaw = 0, negMax = 0;
  for (const [label, score] of Object.entries(positive)) {
    const weight = matchesDominant(label, dominants) ? 2 : 1;
    posRaw += score * weight;
    posMax += 10 * weight;
  }
  for (const [label, score] of Object.entries(negative)) {
    const weight = matchesDominant(label, dominants) ? 2 : 1;
    negRaw += score * weight;
    negMax += 10 * weight;
  }
  const posNorm = posMax ? (posRaw / posMax) * 100 : 0;
  const negNorm = negMax ? (negRaw / negMax) * 100 : 0;
  const overallRaw = (posNorm + (100 - negNorm)) / 2;
  const overall = Math.max(0, Math.min(100, Math.round(overallRaw * 100) / 100));
  return {
    positive_raw: posRaw,
    positive_max: posMax,
    negative_raw: negRaw,
    negative_max: negMax,
    positive_normalized: Math.round(posNorm * 100) / 100,
    negative_normalized: Math.round(negNorm * 100) / 100,
    overall,
  };
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

  // Compute aggregation ourselves; the judge's own math is unreliable.
  const agg = computeAggregation(positive_scores, negative_scores, dominant_criteria);
  const aggregation = {
    positive_raw: agg.positive_raw,
    positive_max: agg.positive_max,
    negative_raw: agg.negative_raw,
    negative_max: agg.negative_max,
    positive_normalized: agg.positive_normalized,
    negative_normalized: agg.negative_normalized,
  };
  const overall_score = agg.overall;

  const rationale = (sections['rationale'] ?? '').trim();

  return { dominant_criteria, positive_scores, negative_scores, aggregation, overall_score, rationale, raw_output: raw };
}

type JudgeToolInput = {
  dominant_criteria: string[];
  positive_scores: Record<string, number>;
  negative_scores: Record<string, number>;
  rationale: string;
};

export async function judgeResponse(
  scenario: ScenarioForJudge,
  responseText: string,
  judgeModel = 'claude-sonnet-4-6'
): Promise<JudgeResult> {
  const anthropic = new Anthropic();
  const prompt = buildPrompt(scenario, responseText);
  const res = await anthropic.messages.create({
    model: judgeModel,
    max_tokens: 4096,
    tools: [JUDGE_TOOL],
    tool_choice: { type: 'tool', name: 'submit_rubric_evaluation' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = res.content.find(b => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use' || toolUse.name !== 'submit_rubric_evaluation') {
    throw new Error('judge did not call the expected tool');
  }
  const input = toolUse.input as JudgeToolInput;

  const agg = computeAggregation(input.positive_scores, input.negative_scores, input.dominant_criteria);

  return {
    dominant_criteria: input.dominant_criteria,
    positive_scores: input.positive_scores,
    negative_scores: input.negative_scores,
    aggregation: {
      positive_raw: agg.positive_raw,
      positive_max: agg.positive_max,
      negative_raw: agg.negative_raw,
      negative_max: agg.negative_max,
      positive_normalized: agg.positive_normalized,
      negative_normalized: agg.negative_normalized,
    },
    overall_score: agg.overall,
    rationale: input.rationale,
    raw_output: JSON.stringify(input, null, 2),
  };
}
