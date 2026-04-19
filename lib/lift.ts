import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from './supabase';
import { judgeResponse, type ScenarioForJudge } from './judge';

const DEFAULT_STUDENT_MODEL = 'claude-haiku-4-5-20251001';
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

async function student(prompt: string, model: string): Promise<string> {
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model,
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
  examples: { scenario_prompt: string; text: string; score?: number | null }[]
): string {
  // Sort highest-scoring first so the prompt leads with the strongest exemplars.
  const ranked = [...examples].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const exampleBlocks = ranked
    .map((e, i) => {
      const scoreLine = e.score != null ? ` (rubric score: ${e.score.toFixed(0)}/100)` : '';
      return `--- HIGH-SCORING HUMAN EXAMPLE ${i + 1}${scoreLine} ---
SCENARIO:
${e.scenario_prompt}

RESPONSE:
${e.text}
`;
    })
    .join('\n');
  return `Below are examples of human responses to emotionally difficult scenarios, each scored against a rubric that rewards specificity, restraint, and obedience to stated constraints, and penalizes platitudes, euphemism, and centering the writer. Study the register. Do not copy phrases; imitate the discipline.

${exampleBlocks}

Now respond to this new scenario with the same discipline. Write only the response itself, no preamble.

SCENARIO:
${scenarioPrompt}`;
}

export async function computeLift(
  scenarioId: number,
  userResponseId: number | null,
  studentModel: string = DEFAULT_STUDENT_MODEL
): Promise<LiftResult | null> {
  const db = supabaseService();

  // Cache check
  const cacheQuery = db
    .from('dataset_lift_snapshots')
    .select('*')
    .eq('scenario_id', scenarioId)
    .eq('student_model', studentModel)
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

  // Dataset examples: public humans from OTHER scenarios, filtered by quality (score >= 70).
  // Prefer same-subcategory exemplars when possible (voicemail → voicemail, etc.) — this is
  // a lightweight retrieval step that improves the in-context signal.
  const targetSub = ((scenario.metadata as any)?.subcategory ?? null) as string | null;
  const { data: humans } = await db
    .from('responses')
    .select('scenario_id, text, scenarios!inner(prompt, metadata), judgments(overall_score)')
    .eq('model', 'human:public')
    .neq('scenario_id', scenarioId);
  const raw = ((humans ?? []) as any[])
    .map(h => {
      const js = (h.judgments ?? []) as { overall_score: number }[];
      const score = js.length ? Math.max(...js.map(j => j.overall_score)) : null;
      const sub = (h.scenarios?.metadata?.subcategory ?? null) as string | null;
      return {
        scenario_prompt: h.scenarios.prompt,
        text: h.text,
        score,
        matchesSub: targetSub !== null && sub === targetSub,
      };
    })
    .filter(e => e.score === null || e.score >= 70);
  // Sort: same-subcategory first, then by score descending. Take up to top-8 to keep prompt tight.
  const examples = raw
    .sort((a, b) => {
      if (a.matchesSub !== b.matchesSub) return a.matchesSub ? -1 : 1;
      return (b.score ?? 0) - (a.score ?? 0);
    })
    .slice(0, 8);

  const basePrompt = buildBasePrompt(scenario.prompt);
  const ownPrompt = userResponseText
    ? buildExamplePrompt(scenario.prompt, [{ scenario_prompt: scenario.prompt, text: userResponseText }])
    : null;
  const datasetPrompt = examples.length
    ? buildExamplePrompt(scenario.prompt, examples)
    : buildBasePrompt(scenario.prompt); // fallback: no examples yet, same as base

  const [baseText, ownText, datasetText] = await Promise.all([
    student(basePrompt, studentModel),
    ownPrompt ? student(ownPrompt, studentModel) : Promise.resolve<string | null>(null),
    student(datasetPrompt, studentModel),
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
    student_model: studentModel,
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
    { onConflict: 'scenario_id,user_response_id,student_model' }
  );

  return result;
}
