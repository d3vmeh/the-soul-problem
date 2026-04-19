import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import OpenAI from 'openai';
import { supabaseService } from '../lib/supabase';

const openai = new OpenAI();

async function gpt(model: string, prompt: string, system?: string): Promise<string> {
  const messages: { role: 'system' | 'user'; content: string }[] = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const res = await openai.chat.completions.create({
    model,
    max_completion_tokens: 700,
    messages,
  });
  return res.choices[0]?.message?.content ?? '';
}

async function main() {
  const db = supabaseService();
  const { data: scenarios, error } = await db.from('scenarios').select('id, prompt').order('id');
  if (error) throw error;
  if (!scenarios?.length) throw new Error('no scenarios');

  const models: { name: string; run: (p: string) => Promise<string> }[] = [
    { name: 'gpt-4o', run: p => gpt('gpt-4o', p) },
    { name: 'gpt-4o-mini', run: p => gpt('gpt-4o-mini', p) },
  ];

  // Clear any prior runs of these exact variants so re-seeds replace cleanly.
  for (const m of models) {
    await db.from('responses').delete().eq('model', m.name);
  }

  const rows: { scenario_id: number; model: string; text: string }[] = [];
  for (const sc of scenarios) {
    for (const m of models) {
      console.log(`scenario ${sc.id} × ${m.name}`);
      rows.push({ scenario_id: sc.id, model: m.name, text: await m.run(sc.prompt) });
    }
  }
  const { error: insErr } = await db.from('responses').insert(rows);
  if (insErr) throw insErr;
  console.log(`seeded ${rows.length} OpenAI responses`);
}

main().catch(e => { console.error(e); process.exit(1); });
