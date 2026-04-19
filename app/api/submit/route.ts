import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '@/lib/judge';

export const maxDuration = 60;

const Payload = z.object({
  scenario_id: z.number().int(),
  text: z.string().min(1).max(5000),
  contribute: z.boolean().default(false),
});

const JUDGE_MODEL = 'claude-sonnet-4-6';

export async function POST(req: Request) {
  const body = Payload.parse(await req.json());
  const db = supabaseService();

  const { data: scenario, error: scErr } = await db
    .from('scenarios')
    .select('id, prompt, metadata')
    .eq('id', body.scenario_id)
    .single();
  if (scErr || !scenario) {
    return NextResponse.json({ error: 'scenario not found' }, { status: 404 });
  }

  // Persist the submission as a response row with model 'human:public' or 'human:private'
  // Private submissions are kept so the result page has a stable URL, but aggregate views filter them out.
  const modelLabel = body.contribute ? 'human:public' : 'human:private';
  const { data: inserted, error: insErr } = await db
    .from('responses')
    .insert({ scenario_id: body.scenario_id, model: modelLabel, text: body.text })
    .select('id')
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? 'insert failed' }, { status: 500 });
  }

  try {
    const result = await judgeResponse(scenario as ScenarioForJudge, body.text, JUDGE_MODEL);
    await db.from('judgments').insert({
      response_id: inserted.id,
      judge_model: JUDGE_MODEL,
      overall_score: result.overall_score,
      positive_scores: result.positive_scores,
      negative_scores: result.negative_scores,
      dominant_criteria: result.dominant_criteria,
      aggregation: result.aggregation,
      rationale: result.rationale,
      raw_output: result.raw_output,
    });
    return NextResponse.json({ response_id: inserted.id });
  } catch (e) {
    // Judge failed but submission survives — the result page will show a graceful error.
    console.error('judge failed:', e);
    return NextResponse.json(
      { response_id: inserted.id, warning: 'judge failed; score unavailable' },
      { status: 200 }
    );
  }
}
