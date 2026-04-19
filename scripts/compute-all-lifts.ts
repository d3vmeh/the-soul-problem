import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { supabaseService } from '../lib/supabase';
import { computeLift } from '../lib/lift';

async function main() {
  const db = supabaseService();

  // Clear existing snapshots so the leaderboard reflects the new filtered exemplars.
  await db.from('dataset_lift_snapshots').delete().gte('id', 0);

  const { data: scenarios } = await db.from('scenarios').select('id').order('id');
  if (!scenarios?.length) throw new Error('no scenarios');

  let ok = 0;
  for (const s of scenarios) {
    process.stdout.write(`scenario ${s.id}... `);
    try {
      const r = await computeLift(s.id, null);
      if (!r) { console.log('no scenario'); continue; }
      console.log(`base=${r.base_score.toFixed(1)} dataset=${r.dataset_score.toFixed(1)} delta=${(r.dataset_score - r.base_score).toFixed(1)}`);
      ok++;
    } catch (e) {
      console.log(`FAILED: ${(e as Error).message}`);
    }
  }

  console.log(`\ncomputed ${ok} / ${scenarios.length} lift snapshots`);

  // Summary: mean base vs mean dataset
  const { data: snaps } = await db.from('dataset_lift_snapshots').select('base_score, dataset_score');
  if (snaps?.length) {
    const baseMean = snaps.reduce((a, b) => a + b.base_score, 0) / snaps.length;
    const datasetMean = snaps.reduce((a, b) => a + b.dataset_score, 0) / snaps.length;
    console.log(`\nBase Haiku mean: ${baseMean.toFixed(2)}`);
    console.log(`Haiku + corpus mean: ${datasetMean.toFixed(2)}`);
    console.log(`Lift: ${(datasetMean - baseMean >= 0 ? '+' : '')}${(datasetMean - baseMean).toFixed(2)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
