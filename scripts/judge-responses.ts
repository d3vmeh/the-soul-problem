import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { supabaseService } from '../lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '../lib/judge';

const JUDGE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

async function main() {
  const db = supabaseService();

  const { data: responses, error } = await db
    .from('responses')
    .select('*, scenarios!inner(id, prompt, metadata)')
    .order('id');
  if (error) throw error;
  if (!responses?.length) throw new Error('no responses in DB — seed responses first');

  const total = responses.length * JUDGE_MODELS.length;
  console.log(`judging ${responses.length} responses × ${JUDGE_MODELS.length} judge models = ${total} calls`);

  let done = 0;
  for (const r of responses) {
    const scenario = (r as any).scenarios as ScenarioForJudge;

    for (const judgeModel of JUDGE_MODELS) {
      done++;
      process.stdout.write(`  [${done}/${total}] response ${r.id} (${r.model}) judged by ${judgeModel}... `);
      try {
        const parsed = await judgeResponse(scenario, r.text, judgeModel);
        const { error: insErr } = await db.from('judgments').upsert({
          response_id: r.id,
          judge_model: judgeModel,
          overall_score: parsed.overall_score,
          positive_scores: parsed.positive_scores,
          negative_scores: parsed.negative_scores,
          dominant_criteria: parsed.dominant_criteria,
          aggregation: parsed.aggregation,
          rationale: parsed.rationale,
          raw_output: parsed.raw_output,
        }, { onConflict: 'response_id,judge_model' });
        if (insErr) throw insErr;
        console.log(`overall=${parsed.overall_score}`);
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  }
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
