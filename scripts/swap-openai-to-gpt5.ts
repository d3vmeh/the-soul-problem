import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import OpenAI from 'openai';
import { supabaseService } from '../lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '../lib/judge';

const OLD_MODELS = ['gpt-4o', 'gpt-4o-mini'];
const NEW_MODELS = [
  { name: 'gpt-5.4', apiModel: 'gpt-5.4' },
  { name: 'gpt-5.4-mini', apiModel: 'gpt-5.4-mini' },
];
const JUDGE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

async function gpt(openai: OpenAI, model: string, prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model,
    max_completion_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0]?.message?.content ?? '';
}

async function main() {
  const db = supabaseService();
  const openai = new OpenAI();

  // Drop old GPT-4o rows (cascades judgments).
  for (const m of OLD_MODELS) {
    const { error, count } = await db.from('responses').delete({ count: 'exact' }).eq('model', m);
    if (error) throw error;
    console.log(`removed ${count ?? 0} ${m} rows`);
  }

  // Also drop any prior runs of the new models so this is idempotent.
  for (const m of NEW_MODELS) {
    await db.from('responses').delete().eq('model', m.name);
  }

  const { data: scenarios } = await db.from('scenarios').select('id, prompt, metadata').order('id');
  if (!scenarios?.length) throw new Error('no scenarios');
  console.log(`generating ${scenarios.length} scenarios × ${NEW_MODELS.length} models = ${scenarios.length * NEW_MODELS.length} responses`);

  const rows: { scenario_id: number; model: string; text: string }[] = [];
  for (const sc of scenarios) {
    for (const m of NEW_MODELS) {
      process.stdout.write(`  gen scenario ${sc.id} × ${m.name}... `);
      try {
        const text = await gpt(openai, m.apiModel, sc.prompt);
        rows.push({ scenario_id: sc.id, model: m.name, text });
        console.log('ok');
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  }

  const { data: inserted, error } = await db.from('responses').insert(rows).select('id, scenario_id, text, model, scenarios(prompt, metadata)');
  if (error) throw error;
  console.log(`inserted ${inserted?.length ?? 0} responses`);

  // Judge every new response with both judges.
  console.log(`judging ${(inserted?.length ?? 0) * JUDGE_MODELS.length} (response × judge) pairs...`);
  let ok = 0;
  for (const r of (inserted ?? []) as any[]) {
    const scenario: ScenarioForJudge = { prompt: r.scenarios.prompt, metadata: r.scenarios.metadata };
    for (const judgeModel of JUDGE_MODELS) {
      process.stdout.write(`  judge ${r.id} × ${judgeModel}... `);
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
        console.log(`${parsed.overall_score.toFixed(1)}`);
        ok++;
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  }
  console.log(`\ndone. ${ok} judgments recorded.`);
}

main().catch(e => { console.error(e); process.exit(1); });
