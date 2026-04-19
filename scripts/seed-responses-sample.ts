import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from '../lib/supabase';

const anthropic = new Anthropic();

async function claude(model: string, prompt: string, systemPrefix = ''): Promise<string> {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system: systemPrefix || undefined,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  return block.type === 'text' ? block.text : '';
}

async function main() {
  const limit = Number(process.env.SEED_LIMIT ?? 5);
  const db = supabaseService();

  const { data: scenarios, error } = await db
    .from('scenarios')
    .select('*')
    .order('id')
    .limit(limit);
  if (error) throw error;
  if (!scenarios?.length) throw new Error('no scenarios — seed scenarios first');

  const scenarioIds = scenarios.map(s => s.id);
  const { error: delErr } = await db.from('responses').delete().in('scenario_id', scenarioIds);
  if (delErr) throw delErr;

  const models: { name: string; run: (p: string) => Promise<string> }[] = [
    { name: 'claude-opus-4-7',   run: p => claude('claude-opus-4-7', p) },
    { name: 'claude-sonnet-4-6', run: p => claude('claude-sonnet-4-6', p) },
    { name: 'claude-haiku-4-5',  run: p => claude('claude-haiku-4-5-20251001', p) },
    { name: 'claude-opus-blunt', run: p => claude('claude-opus-4-7', p, 'Respond in a blunt, no-fluff tone. Do not soften.') },
  ];

  console.log(`sampling ${scenarios.length} scenarios × ${models.length} models = ${scenarios.length * models.length} responses`);

  let done = 0;
  for (const sc of scenarios) {
    const batch: { scenario_id: number; model: string; text: string }[] = [];
    for (const m of models) {
      const text = await m.run(sc.prompt);
      batch.push({ scenario_id: sc.id, model: m.name, text });
      done++;
      console.log(`  [${done}/${scenarios.length * models.length}] scenario ${sc.id} × ${m.name}`);
    }
    const { error: insErr } = await db.from('responses').insert(batch);
    if (insErr) throw insErr;
  }

  console.log(`inserted ${done} responses for scenarios ${scenarioIds.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
