import { supabaseService } from '@/lib/supabase';
import { assembleExportRow } from '@/lib/export';

export async function GET() {
  const db = supabaseService();
  const { data } = await db
    .from('labels')
    .select(`
      *,
      experts(id, background),
      responses(id, scenario_id, model, text, scenarios(id, prompt, metadata))
    `);

  const lines = (data ?? []).map((l: any) =>
    JSON.stringify(assembleExportRow({
      expert: { id: l.experts.id, background: l.experts.background },
      scenario: {
        id: l.responses.scenarios.id,
        prompt: l.responses.scenarios.prompt,
        metadata: l.responses.scenarios.metadata ?? {},
      },
      response: {
        id: l.responses.id,
        scenario_id: l.responses.scenario_id,
        model: l.responses.model,
        text: l.responses.text,
      },
      label: {
        expert_id: l.expert_id,
        response_id: l.response_id,
        accountability: l.accountability,
        specificity: l.specificity,
        warmth: l.warmth,
        reasoning: l.reasoning,
        submitted_at: l.submitted_at,
      },
    }))
  );

  const body = lines.length ? lines.join('\n') + '\n' : '';
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson',
      'content-disposition': 'attachment; filename="eq-apologies-labels.jsonl"',
    },
  });
}
