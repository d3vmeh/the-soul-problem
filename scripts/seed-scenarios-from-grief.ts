import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';

type GriefPrompt = {
  id: string;
  subcategory: string;
  writer_role: string;
  recipient: string;
  relationship_closeness: string;
  medium: string;
  time_since_loss: string;
  cause_or_context: string;
  word_count_target: string;
  prompt_text: string;
  scoring_criteria_positive: string[];
  scoring_criteria_negative: string[];
  criteria_weights_hint: string;
};

async function main() {
  const raw = JSON.parse(readFileSync('prompts/grief_loss_v1.json', 'utf8')) as GriefPrompt[];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('no prompts');

  const rows = raw.map(p => ({
    prompt: p.prompt_text,
    metadata: {
      source_id: p.id,
      subcategory: p.subcategory,
      writer_role: p.writer_role,
      recipient: p.recipient,
      relationship_closeness: p.relationship_closeness,
      medium: p.medium,
      time_since_loss: p.time_since_loss,
      cause_or_context: p.cause_or_context,
      word_count_target: p.word_count_target,
      scoring_criteria_positive: p.scoring_criteria_positive,
      scoring_criteria_negative: p.scoring_criteria_negative,
      criteria_weights_hint: p.criteria_weights_hint,
    },
  }));

  const db = supabaseService();

  // Wipe scenarios (cascades: responses → labels, assignments).
  const { error: delErr } = await db.from('scenarios').delete().gte('id', 0);
  if (delErr) throw delErr;

  const { error: insErr } = await db.from('scenarios').insert(rows);
  if (insErr) throw insErr;

  console.log(`seeded ${rows.length} grief/loss scenarios (cleared prior responses/labels/assignments via cascade)`);
}

main().catch(e => { console.error(e); process.exit(1); });
