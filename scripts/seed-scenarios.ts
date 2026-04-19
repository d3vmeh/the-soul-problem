import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';

async function main() {
  const scenarios = JSON.parse(readFileSync('data/scenarios.json', 'utf8'));
  const db = supabaseService();
  await db.from('scenarios').delete().gte('id', 0);
  const { error } = await db.from('scenarios').insert(scenarios);
  if (error) throw error;
  console.log(`seeded ${scenarios.length} scenarios`);
}

main().catch(e => { console.error(e); process.exit(1); });
