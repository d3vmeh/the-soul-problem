import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from '../lib/supabase';

const anthropic = new Anthropic();

async function claude(model: string, prompt: string, systemPrefix = ''): Promise<string> {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system: systemPrefix || undefined,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  return block.type === 'text' ? block.text : '';
}

async function main() {
  const db = supabaseService();
  const { data: scenarios, error } = await db.from('scenarios').select('*').order('id');
  if (error) throw error;
  if (!scenarios?.length) throw new Error('seed scenarios first');

  await db.from('responses').delete().gte('id', 0);

  const models: { name: string; run: (p: string) => Promise<string> }[] = [
    { name: 'claude-opus-4-7',   run: p => claude('claude-opus-4-7', p) },
    { name: 'claude-sonnet-4-6', run: p => claude('claude-sonnet-4-6', p) },
    { name: 'claude-haiku-4-5',  run: p => claude('claude-haiku-4-5-20251001', p) },
    { name: 'claude-opus-blunt', run: p => claude('claude-opus-4-7', p, 'Respond in a blunt, no-fluff tone. Do not soften.') },
  ];

  const rows: { scenario_id: number; model: string; text: string }[] = [];
  for (const sc of scenarios) {
    for (const m of models) {
      console.log(`scenario ${sc.id} × ${m.name}`);
      rows.push({ scenario_id: sc.id, model: m.name, text: await m.run(sc.prompt) });
    }
  }
  const { error: insErr } = await db.from('responses').insert(rows);
  if (insErr) throw insErr;
  console.log(`seeded ${rows.length} responses`);
}

main().catch(e => { console.error(e); process.exit(1); });
