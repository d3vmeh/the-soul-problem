import { supabaseService } from '@/lib/supabase';

const SCORE_THRESHOLD = 75;

export async function GET() {
  const db = supabaseService();
  // Every public human response with at least one judgment ≥ threshold.
  const { data } = await db
    .from('responses')
    .select(`
      id, text, model, scenario_id,
      scenarios(prompt, metadata),
      judgments(overall_score, judge_model)
    `)
    .eq('model', 'human:public');

  const lines: string[] = [];
  for (const r of (data ?? []) as any[]) {
    const judgments = (r.judgments ?? []) as { overall_score: number; judge_model: string }[];
    if (!judgments.length) continue;
    const maxScore = Math.max(...judgments.map(j => j.overall_score));
    if (maxScore < SCORE_THRESHOLD) continue;

    lines.push(JSON.stringify({
      messages: [
        { role: 'user', content: r.scenarios.prompt },
        { role: 'assistant', content: r.text },
      ],
      metadata: {
        scenario_id: r.scenario_id,
        response_id: r.id,
        score: maxScore,
        scenario_metadata: r.scenarios.metadata,
      },
    }));
  }

  const body = lines.length ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson',
      'content-disposition': 'attachment; filename="the-soul-problem-sft.jsonl"',
    },
  });
}
