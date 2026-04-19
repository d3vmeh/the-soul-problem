import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { supabaseService } from '../lib/supabase';
import { computeLift } from '../lib/lift';

const STUDENT = 'claude-opus-4-7';

async function main() {
  const db = supabaseService();
  await db.from('dataset_lift_snapshots').delete().eq('student_model', STUDENT);

  const { data: scenarios } = await db.from('scenarios').select('id').order('id');
  if (!scenarios?.length) throw new Error('no scenarios');

  let ok = 0;
  for (const s of scenarios) {
    process.stdout.write(`scenario ${s.id}... `);
    try {
      const r = await computeLift(s.id, null, STUDENT);
      if (!r) { console.log('no scenario'); continue; }
      console.log(`base=${r.base_score.toFixed(1)} dataset=${r.dataset_score.toFixed(1)} delta=${(r.dataset_score - r.base_score).toFixed(1)}`);
      ok++;
    } catch (e) {
      console.log(`FAILED: ${(e as Error).message}`);
    }
  }

  console.log(`\ncomputed ${ok} / ${scenarios.length} snapshots for ${STUDENT}`);
  const { data: snaps } = await db
    .from('dataset_lift_snapshots')
    .select('base_score, dataset_score')
    .eq('student_model', STUDENT);
  if (snaps?.length) {
    const baseMean = snaps.reduce((a, b) => a + b.base_score, 0) / snaps.length;
    const datasetMean = snaps.reduce((a, b) => a + b.dataset_score, 0) / snaps.length;
    console.log(`\nBase Opus: ${baseMean.toFixed(2)}`);
    console.log(`Opus + corpus: ${datasetMean.toFixed(2)}`);
    console.log(`Lift: ${datasetMean - baseMean >= 0 ? '+' : ''}${(datasetMean - baseMean).toFixed(2)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
