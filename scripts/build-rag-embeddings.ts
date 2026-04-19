import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import OpenAI from 'openai';
import { writeFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';

const EMBED_MODEL = 'text-embedding-3-small'; // 1536-dim, fast, cheap

async function main() {
  const db = supabaseService();
  const { data: scenarios, error } = await db.from('scenarios').select('id, prompt, metadata').order('id');
  if (error) throw error;
  if (!scenarios?.length) throw new Error('no scenarios');

  const openai = new OpenAI();

  // One embedding per scenario. Prompt text is the dominant signal; metadata (medium, subcategory)
  // is prepended for lightweight semantic hints.
  const texts = scenarios.map(s => {
    const md = (s.metadata ?? {}) as any;
    const tags = [md.subcategory, md.medium, md.writer_role, md.recipient]
      .filter(Boolean)
      .join(' · ');
    return tags ? `${tags}\n\n${s.prompt}` : s.prompt;
  });

  console.log(`embedding ${texts.length} scenarios...`);
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  if (res.data.length !== texts.length) throw new Error(`mismatch: ${res.data.length} vectors for ${texts.length} inputs`);

  const out = {
    model: EMBED_MODEL,
    generated_at: new Date().toISOString(),
    scenarios: scenarios.map((s, i) => ({
      id: s.id,
      prompt: s.prompt,
      metadata: s.metadata,
      embedding: res.data[i].embedding,
    })),
  };

  writeFileSync('data/rag-embeddings.json', JSON.stringify(out));
  console.log(`saved ${out.scenarios.length} embeddings (${EMBED_MODEL}, 1536-dim) to data/rag-embeddings.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
