import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getExpert } from '@/lib/session';
import { meanAbsoluteDeviation, screenerPassed, SCREENER_MAD_THRESHOLD } from '@/lib/scoring';
import { assignNewExpert } from '@/lib/assignments';

export async function POST(req: Request) {
  const expert = await getExpert();
  if (!expert) return NextResponse.redirect(new URL('/', req.url), { status: 303 });

  const { answers } = (await req.json()) as { answers: Record<string, number[]> };
  const db = supabaseService();
  const { data: questions } = await db.from('screener_questions').select('*').order('id');
  if (!questions?.length) return NextResponse.json({ error: 'no questions' }, { status: 500 });

  const rows: { expert_id: string; question_id: number; predicted_intensities: number[]; abs_deviation: number }[] = [];
  const allDeviations: number[] = [];

  for (const q of questions) {
    const predicted = answers[q.id] ?? answers[String(q.id)] ?? [];
    const ref = q.reference_intensities as number[];
    const mad = meanAbsoluteDeviation(predicted, ref);
    rows.push({ expert_id: expert.id, question_id: q.id, predicted_intensities: predicted, abs_deviation: mad });
    for (let i = 0; i < predicted.length; i++) allDeviations.push(Math.abs(predicted[i] - ref[i]));
  }

  const aggregate = allDeviations.reduce((a, b) => a + b, 0) / allDeviations.length;
  const passed = screenerPassed(aggregate, SCREENER_MAD_THRESHOLD);

  await db.from('screener_answers').delete().eq('expert_id', expert.id);
  await db.from('screener_answers').insert(rows);
  await db.from('experts').update({ screener_passed: passed, screener_mad: aggregate }).eq('id', expert.id);

  if (passed) {
    // Idempotent in practice because of the unique(expert_id, scenario_id) constraint,
    // but we skip re-assignment if this expert already has assignments.
    const { count } = await db
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('expert_id', expert.id);
    if (!count) await assignNewExpert(expert.id);
  }

  return NextResponse.redirect(new URL(passed ? '/project' : '/screener/thanks', req.url), { status: 303 });
}
