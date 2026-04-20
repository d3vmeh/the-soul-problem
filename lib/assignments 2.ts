import { supabaseService } from './supabase';

export const SCENARIOS_PER_EXPERT = 10;
export const GRADERS_PER_SCENARIO = 3;

export function pickScenariosForNewExpert(opts: {
  graderCounts: Map<number, number>;
  scenariosPerExpert: number;
  gradersPerScenario: number;
}): number[] {
  const candidates = [...opts.graderCounts.entries()]
    .filter(([, count]) => count < opts.gradersPerScenario)
    .sort(([idA, a], [idB, b]) => a - b || idA - idB)
    .map(([id]) => id);
  return candidates.slice(0, opts.scenariosPerExpert);
}

export async function assignNewExpert(expertId: string): Promise<number[]> {
  const db = supabaseService();
  const { data: scenarios } = await db.from('scenarios').select('id');
  if (!scenarios?.length) return [];

  const { data: existing } = await db.from('assignments').select('scenario_id');
  const counts = new Map<number, number>();
  for (const s of scenarios) counts.set(s.id, 0);
  for (const a of existing ?? []) {
    counts.set(a.scenario_id, (counts.get(a.scenario_id) ?? 0) + 1);
  }

  const picks = pickScenariosForNewExpert({
    graderCounts: counts,
    scenariosPerExpert: SCENARIOS_PER_EXPERT,
    gradersPerScenario: GRADERS_PER_SCENARIO,
  });
  if (!picks.length) return [];

  const rows = picks.map(scenario_id => ({ expert_id: expertId, scenario_id }));
  const { error } = await db.from('assignments').insert(rows);
  if (error) throw error;
  return picks;
}

export async function getAssignedScenarioIds(expertId: string): Promise<number[]> {
  const db = supabaseService();
  const { data } = await db
    .from('assignments')
    .select('scenario_id')
    .eq('expert_id', expertId)
    .order('scenario_id');
  return (data ?? []).map(a => a.scenario_id);
}
