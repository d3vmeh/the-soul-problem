import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from '../lib/supabase';

const anthropic = new Anthropic();

const JUDGE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

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

type Scenario = {
  id: number;
  prompt: string;
  metadata: {
    scoring_criteria_positive: string[];
    scoring_criteria_negative: string[];
    criteria_weights_hint: string;
  };
};

type ModelResponse = {
  id: number;
  scenario_id: number;
  model: string;
  text: string;
};

type ParsedJudgment = {
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
  overall_score: number;
  rationale: string;
};

function buildPrompt(scenario: Scenario, response: ModelResponse): string {
  const pos = scenario.metadata.scoring_criteria_positive.map(c => `- ${c}`).join('\n');
  const neg = scenario.metadata.scoring_criteria_negative.map(c => `- ${c}`).join('\n');
  return PROMPT_TEMPLATE
    .replace('{{SCENARIO_PROMPT}}', scenario.prompt)
    .replace('{{RESPONSE}}', response.text)
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

function parseJudgment(raw: string): ParsedJudgment {
  // Split on ## headers; each header starts a new section
  const sections: Record<string, string> = {};
  const blocks = raw.split(/^##\s+/m).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const [header, ...rest] = block.split('\n');
    sections[header.trim().toLowerCase()] = rest.join('\n').trim();
  }

  const dominantSection = sections['dominant criteria (2x weight)'] ?? sections['dominant criteria (2× weight)'] ?? '';
  const dominant_criteria = dominantSection
    .split('\n')
    .map(l => l.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);

  const positive_scores = parseScoreLines(sections['positive scores'] ?? '');
  const negative_scores = parseScoreLines(sections['negative scores'] ?? '');

  const aggText = sections['aggregation'] ?? '';
  // Take the LAST number on the label's line — models often show inline arithmetic
  // ("Positive raw: (10×2) + 4 + 10 = 60") and the final value is what we want.
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

  // Overall line can be "Overall Item Score: 68.63 / 100" (template)
  // or "Overall Item Score: ((0.75 × 100) × (1 − 0.17×0.5)) = 75 × 0.915 = 68.63 / 100" (inline calc).
  // Prefer the "N / 100" pattern; fall back to last number on the line.
  const overallLine = raw.match(/Overall Item Score:[^\n]*/i)?.[0] ?? '';
  const slashMatch = overallLine.match(/(-?\d+(?:\.\d+)?)\s*\/\s*100\b/);
  let overall_score = slashMatch ? parseFloat(slashMatch[1]) : 0;
  if (!slashMatch) {
    const nums = [...overallLine.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
    if (nums.length) overall_score = nums[nums.length - 1];
  }

  const rationale = (sections['rationale'] ?? '').trim();

  return { dominant_criteria, positive_scores, negative_scores, aggregation, overall_score, rationale };
}

async function judgeOne(judgeModel: string, prompt: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: judgeModel,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  return block.type === 'text' ? block.text : '';
}

async function main() {
  const db = supabaseService();

  const { data: responses, error } = await db
    .from('responses')
    .select('*, scenarios!inner(id, prompt, metadata)')
    .order('id');
  if (error) throw error;
  if (!responses?.length) throw new Error('no responses in DB — seed responses first');

  const total = responses.length * JUDGE_MODELS.length;
  console.log(`judging ${responses.length} responses × ${JUDGE_MODELS.length} judge models = ${total} calls`);

  let done = 0;
  for (const r of responses) {
    const scenario = (r as any).scenarios as Scenario;
    const prompt = buildPrompt(scenario, r as ModelResponse);

    for (const judgeModel of JUDGE_MODELS) {
      done++;
      process.stdout.write(`  [${done}/${total}] response ${r.id} (${r.model}) judged by ${judgeModel}... `);
      try {
        const raw = await judgeOne(judgeModel, prompt);
        const parsed = parseJudgment(raw);
        const { error: insErr } = await db.from('judgments').upsert({
          response_id: r.id,
          judge_model: judgeModel,
          overall_score: parsed.overall_score,
          positive_scores: parsed.positive_scores,
          negative_scores: parsed.negative_scores,
          dominant_criteria: parsed.dominant_criteria,
          aggregation: parsed.aggregation,
          rationale: parsed.rationale,
          raw_output: raw,
        }, { onConflict: 'response_id,judge_model' });
        if (insErr) throw insErr;
        console.log(`overall=${parsed.overall_score}`);
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  }
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
