import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { supabaseService } from '../lib/supabase';
import { parseJudgment } from '../lib/judge';

async function main() {
  const db = supabaseService();
  const { data: rows, error } = await db
    .from('judgments')
    .select('id, response_id, judge_model, overall_score, raw_output')
    .order('id');
  if (error) throw error;
  if (!rows?.length) {
    console.log('no judgments to reparse');
    return;
  }

  console.log(`reparsing ${rows.length} judgments with deterministic aggregation`);
  let changed = 0;

  for (const row of rows) {
    if (!row.raw_output) continue;
    const parsed = parseJudgment(row.raw_output);
    const oldOverall = row.overall_score;
    const newOverall = parsed.overall_score;

    if (Math.abs(oldOverall - newOverall) < 0.01) continue;
    changed++;
    console.log(`  judgment ${row.id} (response ${row.response_id}, ${row.judge_model}): ${oldOverall.toFixed(1)} → ${newOverall.toFixed(1)}`);

    const { error: updErr } = await db
      .from('judgments')
      .update({
        overall_score: newOverall,
        positive_scores: parsed.positive_scores,
        negative_scores: parsed.negative_scores,
        dominant_criteria: parsed.dominant_criteria,
        aggregation: parsed.aggregation,
      })
      .eq('id', row.id);
    if (updErr) throw updErr;
  }

  console.log(`\ndone: ${changed} / ${rows.length} judgments corrected`);
}

main().catch(e => { console.error(e); process.exit(1); });
