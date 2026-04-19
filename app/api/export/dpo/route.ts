import { supabaseService } from '@/lib/supabase';

const MIN_SCORE_DELTA = 5;

type DbResponse = {
  id: number;
  text: string;
  model: string;
  scenario_id: number;
  judgments: { overall_score: number; judge_model: string }[];
};

export async function GET() {
  const db = supabaseService();

  const { data: scenarios } = await db
    .from('scenarios')
    .select('id, prompt, metadata');

  const { data: responses } = await db
    .from('responses')
    .select(`
      id, text, model, scenario_id,
      judgments(overall_score, judge_model)
    `);

  const byScenario = new Map<number, DbResponse[]>();
  for (const r of ((responses ?? []) as DbResponse[])) {
    if (!r.judgments?.length) continue;
    const arr = byScenario.get(r.scenario_id) ?? [];
    arr.push(r);
    byScenario.set(r.scenario_id, arr);
  }

  function meanScore(r: DbResponse): number {
    const scores = r.judgments.map(j => j.overall_score);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  const lines: string[] = [];
  for (const scenario of (scenarios ?? [])) {
    const group = byScenario.get(scenario.id) ?? [];
    if (group.length < 2) continue;

    // Sort by mean score, highest first
    const ranked = group
      .map(r => ({ r, mean: meanScore(r) }))
      .sort((a, b) => b.mean - a.mean);

    // Pair every "chosen" (higher-scoring) with every "rejected" (lower-scoring)
    // that's at least MIN_SCORE_DELTA points below. Keeps pairs informative.
    for (let i = 0; i < ranked.length; i++) {
      for (let j = i + 1; j < ranked.length; j++) {
        if (ranked[i].mean - ranked[j].mean < MIN_SCORE_DELTA) continue;
        lines.push(JSON.stringify({
          prompt: scenario.prompt,
          chosen: ranked[i].r.text,
          rejected: ranked[j].r.text,
          metadata: {
            scenario_id: scenario.id,
            chosen_response_id: ranked[i].r.id,
            chosen_model: ranked[i].r.model,
            chosen_score: Number(ranked[i].mean.toFixed(2)),
            rejected_response_id: ranked[j].r.id,
            rejected_model: ranked[j].r.model,
            rejected_score: Number(ranked[j].mean.toFixed(2)),
            score_delta: Number((ranked[i].mean - ranked[j].mean).toFixed(2)),
          },
        }));
      }
    }
  }

  const body = lines.length ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson',
      'content-disposition': 'attachment; filename="the-soul-problem-dpo.jsonl"',
    },
  });
}
