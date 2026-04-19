import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';

async function main() {
  const items = JSON.parse(readFileSync('data/screener.json', 'utf8'));
  const db = supabaseService();
  await db.from('screener_questions').delete().gte('id', 0);
  const { error } = await db.from('screener_questions').insert(items);
  if (error) throw error;
  console.log(`seeded ${items.length} screener questions`);
}

main().catch(e => { console.error(e); process.exit(1); });
