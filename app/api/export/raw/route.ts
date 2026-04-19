import { supabaseService } from '@/lib/supabase';

export async function GET() {
  const db = supabaseService();

  const { data: responses } = await db
    .from('responses')
    .select(`
      id, text, model, scenario_id,
      scenarios(id, prompt, metadata),
      judgments(
        judge_model, overall_score, positive_scores, negative_scores,
        dominant_criteria, aggregation, rationale, created_at
      )
    `)
    .order('scenario_id')
    .order('id');

  const lines = (responses ?? []).map((r: any) => JSON.stringify({
    scenario: {
      id: r.scenarios.id,
      prompt: r.scenarios.prompt,
      metadata: r.scenarios.metadata,
    },
    response: {
      id: r.id,
      model: r.model,
      text: r.text,
    },
    judgments: r.judgments,
  }));

  const body = lines.length ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson',
      'content-disposition': 'attachment; filename="the-soul-problem-raw.jsonl"',
    },
  });
}
