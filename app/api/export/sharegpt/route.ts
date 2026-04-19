import { supabaseService } from '@/lib/supabase';

const SCORE_THRESHOLD = 75;

export async function GET() {
  const db = supabaseService();
  const { data } = await db
    .from('responses')
    .select(`
      id, text, model, scenario_id,
      scenarios(prompt, metadata),
      judgments(overall_score)
    `)
    .eq('model', 'human:public');

  const lines: string[] = [];
  for (const r of (data ?? []) as any[]) {
    const js = (r.judgments ?? []) as { overall_score: number }[];
    if (!js.length) continue;
    const maxScore = Math.max(...js.map(j => j.overall_score));
    if (maxScore < SCORE_THRESHOLD) continue;

    lines.push(JSON.stringify({
      conversations: [
        { from: 'human', value: r.scenarios.prompt },
        { from: 'gpt', value: r.text },
      ],
      metadata: {
        scenario_id: r.scenario_id,
        response_id: r.id,
        score: maxScore,
      },
    }));
  }

  const body = lines.length ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson',
      'content-disposition': 'attachment; filename="the-soul-problem-sharegpt.jsonl"',
    },
  });
}
