import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const EXPECTED = [
  'experts',
  'scenarios',
  'responses',
  'labels',
  'screener_questions',
  'screener_answers',
  'assignments',
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Env check:');
  console.log(`  NEXT_PUBLIC_SUPABASE_URL       : ${url ? '✓ set (' + new URL(url).host + ')' : '✗ missing'}`);
  console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY  : ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ set' : '✗ missing'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY      : ${key ? '✓ set' : '✗ missing'}`);
  console.log(`  ADMIN_PASSWORD                 : ${process.env.ADMIN_PASSWORD ? '✓ set' : '✗ missing'}`);
  console.log(`  ANTHROPIC_API_KEY              : ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ missing'}`);
  console.log('');

  if (!url || !key) {
    console.error('Cannot connect — fix the missing env vars above.');
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log('Table check:');
  let allOk = true;
  for (const table of EXPECTED) {
    // Real SELECT (not HEAD) — HEAD returns {error: null, count: null} even for missing tables.
    const { error, data } = await db.from(table).select('*').limit(1);
    if (error) {
      console.log(`  ${table.padEnd(22)}: ✗ ${error.message}`);
      allOk = false;
    } else {
      // Separate COUNT query for real row count.
      const { count } = await db.from(table).select('*', { count: 'exact', head: true });
      console.log(`  ${table.padEnd(22)}: ✓ (${count ?? data?.length ?? 0} rows)`);
    }
  }
  console.log('');
  if (allOk) {
    console.log('All 7 tables present. Supabase is ready.');
  } else {
    console.log('Migration not fully applied. Re-run supabase/migrations/0001_init.sql in the SQL editor.');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
