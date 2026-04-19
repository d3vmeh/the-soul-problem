import { notFound, redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';
import { blindingOrder } from '@/lib/blinding';
import { getAssignedScenarioIds } from '@/lib/assignments';
import ScenarioForm from './form';

export default async function ScenarioPage({ params }: { params: Promise<{ i: string }> }) {
  const { i } = await params;
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (!expert.screener_passed) redirect('/screener');

  const scenarioId = Number(i);
  const assigned = await getAssignedScenarioIds(expert.id);
  if (!assigned.includes(scenarioId)) notFound();

  const db = supabaseService();
  const { data: scenario } = await db.from('scenarios').select('*').eq('id', scenarioId).single();
  if (!scenario) notFound();
  const { data: responses } = await db.from('responses').select('*').eq('scenario_id', scenarioId);
  if (!responses?.length) notFound();

  const ordered = blindingOrder(responses, expert.id, scenarioId);
  const responseIds = ordered.map(r => r.id);
  const { data: existing } = await db
    .from('labels')
    .select('response_id, accountability, specificity, warmth, reasoning')
    .eq('expert_id', expert.id)
    .in('response_id', responseIds);

  const idx = assigned.findIndex(id => id === scenarioId);
  const nextScenarioId = assigned[idx + 1] ?? null;

  return (
    <ScenarioForm
      scenario={scenario}
      responses={ordered}
      existing={existing ?? []}
      nextScenarioId={nextScenarioId}
    />
  );
}
