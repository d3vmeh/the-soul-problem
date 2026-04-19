import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from '../lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '../lib/judge';

const STUDENT_MODEL = 'claude-haiku-4-5-20251001';
const JUDGE_MODEL = 'claude-sonnet-4-6';

const anthropic = new Anthropic();

async function student(prompt: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: STUDENT_MODEL,
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  return block.type === 'text' ? block.text : '';
}

function buildDatasetPrompt(
  scenarioPrompt: string,
  examples: { scenario_prompt: string; text: string }[]
): string {
  const exampleBlocks = examples
    .map(
      (e, i) => `--- EXAMPLE ${i + 1} ---
SCENARIO:
${e.scenario_prompt}

HUMAN RESPONSE:
${e.text}
`
    )
    .join('\n');
  return `You'll see examples of how humans respond to emotionally difficult scenarios. Learn the register, restraint, and specificity from them — do not copy phrases.

${exampleBlocks}

Now respond to this new scenario. Write only the response itself, no preamble.

SCENARIO:
${scenarioPrompt}`;
}

type Scenario = {
  id: number;
  prompt: string;
  metadata: Record<string, unknown>;
};

async function main() {
  const db = supabaseService();

  const { data: scenarios, error: scErr } = await db.from('scenarios').select('id, prompt, metadata').order('id');
  if (scErr) throw scErr;
  if (!scenarios?.length) throw new Error('no scenarios in DB');

  const { data: humans, error: hErr } = await db
    .from('responses')
    .select('scenario_id, text, scenarios!inner(prompt)')
    .eq('model', 'human:public');
  if (hErr) throw hErr;

  const publicHumans = (humans ?? []).map((h: any) => ({
    scenario_id: h.scenario_id,
    scenario_prompt: h.scenarios.prompt,
    text: h.text,
  }));

  if (publicHumans.length === 0) {
    console.log('no public human contributions — cannot compute lift yet');
    return;
  }

  console.log(`computing lift on ${scenarios.length} held-out scenarios with ${publicHumans.length} public human contributions as examples`);

  const details: {
    scenario_id: number;
    base_score: number;
    dataset_score: number;
    base_text: string;
    dataset_text: string;
    n_examples_used: number;
  }[] = [];

  for (const s of scenarios as Scenario[]) {
    const examples = publicHumans.filter(h => h.scenario_id !== s.id);
    console.log(`  scenario ${s.id}: ${examples.length} examples available`);

    const [baseText, datasetText] = await Promise.all([
      student(`Write a response to this scenario. Write only the response itself, no preamble.\n\nSCENARIO:\n${s.prompt}`),
      student(buildDatasetPrompt(s.prompt, examples)),
    ]);

    const scenarioForJudge: ScenarioForJudge = { prompt: s.prompt, metadata: s.metadata as any };
    const [baseJudgment, datasetJudgment] = await Promise.all([
      judgeResponse(scenarioForJudge, baseText, JUDGE_MODEL),
      judgeResponse(scenarioForJudge, datasetText, JUDGE_MODEL),
    ]);

    console.log(`    base=${baseJudgment.overall_score.toFixed(1)} dataset=${datasetJudgment.overall_score.toFixed(1)} delta=${(datasetJudgment.overall_score - baseJudgment.overall_score).toFixed(1)}`);

    details.push({
      scenario_id: s.id,
      base_score: baseJudgment.overall_score,
      dataset_score: datasetJudgment.overall_score,
      base_text: baseText,
      dataset_text: datasetText,
      n_examples_used: examples.length,
    });
  }

  const baseMean = details.reduce((a, b) => a + b.base_score, 0) / details.length;
  const datasetMean = details.reduce((a, b) => a + b.dataset_score, 0) / details.length;
  const lift = datasetMean - baseMean;

  console.log(`\nbase Haiku mean: ${baseMean.toFixed(2)}`);
  console.log(`Haiku-with-dataset mean: ${datasetMean.toFixed(2)}`);
  console.log(`lift: ${lift >= 0 ? '+' : ''}${lift.toFixed(2)}`);

  const { error: insErr } = await db.from('dataset_lift_snapshots').insert({
    n_contributions: publicHumans.length,
    n_held_out_scenarios: scenarios.length,
    base_haiku_mean: baseMean,
    dataset_haiku_mean: datasetMean,
    lift,
    details,
    judge_model: JUDGE_MODEL,
    student_model: STUDENT_MODEL,
  });
  if (insErr) throw insErr;

  console.log('snapshot saved');
}

main().catch(e => { console.error(e); process.exit(1); });
