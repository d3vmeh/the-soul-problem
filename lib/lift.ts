import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from './supabase';
import { judgeResponse, type ScenarioForJudge } from './judge';

const STUDENT_MODEL = 'claude-haiku-4-5-20251001';
const JUDGE_MODEL = 'claude-sonnet-4-6';

export type LiftResult = {
  scenario_id: number;
  user_response_id: number | null;
  n_dataset_examples: number;
  base_score: number;
  base_text: string;
  own_score: number | null;
  own_text: string | null;
  dataset_score: number;
  dataset_text: string;
  student_model: string;
  judge_model: string;
};

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

function buildBasePrompt(scenarioPrompt: string): string {
  return `Write a response to this scenario. Write only the response itself, no preamble.

SCENARIO:
${scenarioPrompt}`;
}

function buildExamplePrompt(
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

export async function computeLift(scenarioId: number, userResponseId: number | null): Promise<LiftResult | null> {
  const db = supabaseService();

  // Cache check
  const cacheQuery = db
    .from('dataset_lift_snapshots')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('computed_at', { ascending: false })
    .limit(1);
  if (userResponseId === null) {
    cacheQuery.is('user_response_id', null);
  } else {
    cacheQuery.eq('user_response_id', userResponseId);
  }
  const { data: cached } = await cacheQuery.maybeSingle();
  if (cached) {
    return {
      scenario_id: cached.scenario_id,
      user_response_id: cached.user_response_id,
      n_dataset_examples: cached.n_dataset_examples,
      base_score: cached.base_score,
      base_text: cached.base_text,
      own_score: cached.own_score,
      own_text: cached.own_text,
      dataset_score: cached.dataset_score,
      dataset_text: cached.dataset_text,
      student_model: cached.student_model,
      judge_model: cached.judge_model,
    };
  }

  const { data: scenario } = await db
    .from('scenarios')
    .select('id, prompt, metadata')
    .eq('id', scenarioId)
    .single();
  if (!scenario) return null;

  let userResponseText: string | null = null;
  if (userResponseId !== null) {
    const { data: r } = await db.from('responses').select('text').eq('id', userResponseId).maybeSingle();
    userResponseText = r?.text ?? null;
  }

  // Dataset examples: every public human response on OTHER scenarios. Include the user's own scenario
  // is fine because we exclude responses to the held-out scenario itself (would leak answers).
  const { data: humans } = await db
    .from('responses')
    .select('scenario_id, text, scenarios!inner(prompt)')
    .eq('model', 'human:public')
    .neq('scenario_id', scenarioId);
  const examples = (humans ?? []).map((h: any) => ({
    scenario_prompt: h.scenarios.prompt,
    text: h.text,
  }));

  const basePrompt = buildBasePrompt(scenario.prompt);
  const ownPrompt = userResponseText
    ? buildExamplePrompt(scenario.prompt, [{ scenario_prompt: scenario.prompt, text: userResponseText }])
    : null;
  const datasetPrompt = examples.length
    ? buildExamplePrompt(scenario.prompt, examples)
    : buildBasePrompt(scenario.prompt); // fallback: no examples yet, same as base

  const [baseText, ownText, datasetText] = await Promise.all([
    student(basePrompt),
    ownPrompt ? student(ownPrompt) : Promise.resolve<string | null>(null),
    student(datasetPrompt),
  ]);

  const scenarioForJudge: ScenarioForJudge = { prompt: scenario.prompt, metadata: scenario.metadata as any };
  const [baseJudgment, ownJudgment, datasetJudgment] = await Promise.all([
    judgeResponse(scenarioForJudge, baseText, JUDGE_MODEL),
    ownText ? judgeResponse(scenarioForJudge, ownText, JUDGE_MODEL) : Promise.resolve(null),
    judgeResponse(scenarioForJudge, datasetText, JUDGE_MODEL),
  ]);

  const result: LiftResult = {
    scenario_id: scenarioId,
    user_response_id: userResponseId,
    n_dataset_examples: examples.length,
    base_score: baseJudgment.overall_score,
    base_text: baseText,
    own_score: ownJudgment?.overall_score ?? null,
    own_text: ownText,
    dataset_score: datasetJudgment.overall_score,
    dataset_text: datasetText,
    student_model: STUDENT_MODEL,
    judge_model: JUDGE_MODEL,
  };

  await db.from('dataset_lift_snapshots').upsert(
    {
      scenario_id: result.scenario_id,
      user_response_id: result.user_response_id,
      n_dataset_examples: result.n_dataset_examples,
      base_score: result.base_score,
      base_text: result.base_text,
      own_score: result.own_score,
      own_text: result.own_text,
      dataset_score: result.dataset_score,
      dataset_text: result.dataset_text,
      student_model: result.student_model,
      judge_model: result.judge_model,
    },
    { onConflict: 'scenario_id,user_response_id' }
  );

  return result;
}
