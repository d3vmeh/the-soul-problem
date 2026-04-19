import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';
import { getAssignedScenarioIds } from '@/lib/assignments';

export default async function ProjectLanding() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (!expert.screener_passed) redirect('/screener');

  const assignedIds = await getAssignedScenarioIds(expert.id);
  const db = supabaseService();
  const { data: labeled } = await db
    .from('labels')
    .select('response_id, responses!inner(scenario_id)')
    .eq('expert_id', expert.id);

  const completedScenarios = new Set((labeled ?? []).map((l: any) => l.responses.scenario_id));
  const firstTodo = assignedIds.find(id => !completedScenarios.has(id));

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">You're in</h1>
      <p>
        You have {assignedIds.length} assigned scenarios to label. For each, rate 4 responses (A–D) on
        accountability, specificity, and warmth. Expect about 40 minutes.
      </p>
      <p className="text-sm text-neutral-500">
        Completed: {completedScenarios.size} / {assignedIds.length}
      </p>
      {firstTodo ? (
        <Link href={`/project/scenario/${firstTodo}`} className="inline-block px-4 py-2 rounded bg-black text-white">
          {completedScenarios.size === 0 ? 'Start labeling' : 'Resume'}
        </Link>
      ) : (
        <Link href="/done" className="inline-block px-4 py-2 rounded bg-black text-white">Finish</Link>
      )}
    </main>
  );
}
