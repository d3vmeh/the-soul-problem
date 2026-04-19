/**
 * Sonnet + RAG lift test. Writes each per-scenario result to
 * dataset_lift_snapshots with student_model='claude-sonnet-4-6-rag' so the
 * leaderboard (which force-dynamic reads the DB) picks up progress in real
 * time as each scenario completes.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabaseService } from '../lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '../lib/judge';

const STUDENT_MODEL_REAL = 'claude-sonnet-4-6';
const STUDENT_MODEL_TAG = 'claude-sonnet-4-6-rag'; // distinct marker in snapshots
const JUDGE_MODEL = 'claude-sonnet-4-6';
const EMBED_MODEL = 'text-embedding-3-small';
const TOP_K = 5;
const MIN_SCORE_FOR_EXEMPLAR = 70;

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function tagLine(md: any): string {
  return [md?.subcategory, md?.medium, md?.writer_role, md?.recipient].filter(Boolean).join(' · ');
}

function embedText(scenarioPrompt: string, md: any): string {
  const tags = tagLine(md);
  return tags ? `${tags}\n\n${scenarioPrompt}` : scenarioPrompt;
}

async function main() {
  const db = supabaseService();
  const openai = new OpenAI();
  const anthropic = new Anthropic();

  // Clear prior RAG-tagged Sonnet snapshots so we rerun cleanly.
  await db.from('dataset_lift_snapshots').delete().eq('student_model', STUDENT_MODEL_TAG);

  const { data: scenarios } = await db.from('scenarios').select('id, prompt, metadata').order('id');
  if (!scenarios?.length) throw new Error('no scenarios');

  const { data: humans } = await db
    .from('responses')
    .select('id, scenario_id, text, scenarios!inner(prompt, metadata), judgments(overall_score)')
    .eq('model', 'human:public');

  const exemplarsRaw = ((humans ?? []) as any[])
    .map(h => {
      const js = (h.judgments ?? []) as { overall_score: number }[];
      if (!js.length) return null;
      const score = Math.max(...js.map(j => j.overall_score));
      if (score < MIN_SCORE_FOR_EXEMPLAR) return null;
      return {
        response_id: h.id,
        scenario_id: h.scenario_id,
        scenario_prompt: h.scenarios.prompt,
        scenario_metadata: h.scenarios.metadata,
        text: h.text,
        score,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  console.log(`${scenarios.length} scenarios, ${exemplarsRaw.length} exemplars (score >= ${MIN_SCORE_FOR_EXEMPLAR})`);

  // Embed all scenarios in a single call.
  const allToEmbed: string[] = [];
  const scenarioEmbedIdx = new Map<number, number>();
  for (const s of scenarios) {
    scenarioEmbedIdx.set(s.id, allToEmbed.length);
    allToEmbed.push(embedText(s.prompt, s.metadata));
  }
  console.log(`embedding ${allToEmbed.length} scenarios...`);
  const emb = await openai.embeddings.create({ model: EMBED_MODEL, input: allToEmbed });
  const scenarioEmbeddings = new Map<number, number[]>();
  for (const s of scenarios) {
    scenarioEmbeddings.set(s.id, emb.data[scenarioEmbedIdx.get(s.id)!].embedding);
  }
  const exemplars = exemplarsRaw.map(e => ({ ...e, embedding: scenarioEmbeddings.get(e.scenario_id)! }));

  // Per-scenario loop: run base + RAG Sonnet, judge both, persist a snapshot.
  const results: { id: number; base: number; rag: number; delta: number }[] = [];
  let idx = 0;
  for (const target of scenarios) {
    idx++;
    process.stdout.write(`[${idx}/${scenarios.length}] scenario ${target.id}: `);

    const targetEmb = scenarioEmbeddings.get(target.id)!;
    const candidates = exemplars.filter(e => e.scenario_id !== target.id);
    if (candidates.length === 0) {
      console.log('no exemplars, skip');
      continue;
    }
    const ranked = candidates
      .map(c => ({ ...c, sim: cosine(targetEmb, c.embedding) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K);

    const basePrompt = `Write a response to this scenario. Write only the response itself, no preamble.\n\nSCENARIO:\n${target.prompt}`;
    const ragPrompt = `Below are examples of human responses to emotionally difficult scenarios, retrieved as semantically similar to the target. Study the register — restraint, specificity, obedience to stated constraints, no platitudes. Do not copy phrases; imitate the discipline.

${ranked.map((e, i) => `--- HUMAN EXAMPLE ${i + 1} (rubric score ${e.score.toFixed(0)}/100) ---
SCENARIO:
${e.scenario_prompt}

RESPONSE:
${e.text}
`).join('\n')}

Now respond to this new scenario with the same discipline. Write only the response itself, no preamble.

SCENARIO:
${target.prompt}`;

    try {
      const [baseRes, ragRes] = await Promise.all([
        anthropic.messages.create({ model: STUDENT_MODEL_REAL, max_tokens: 700, messages: [{ role: 'user', content: basePrompt }] }),
        anthropic.messages.create({ model: STUDENT_MODEL_REAL, max_tokens: 700, messages: [{ role: 'user', content: ragPrompt }] }),
      ]);
      const baseText = baseRes.content[0].type === 'text' ? baseRes.content[0].text : '';
      const ragText = ragRes.content[0].type === 'text' ? ragRes.content[0].text : '';

      const scenarioForJudge: ScenarioForJudge = { prompt: target.prompt, metadata: target.metadata as any };
      const [baseJ, ragJ] = await Promise.all([
        judgeResponse(scenarioForJudge, baseText, JUDGE_MODEL),
        judgeResponse(scenarioForJudge, ragText, JUDGE_MODEL),
      ]);
      const delta = ragJ.overall_score - baseJ.overall_score;

      // Write snapshot immediately so the leaderboard reflects progress.
      const { error } = await db.from('dataset_lift_snapshots').upsert({
        scenario_id: target.id,
        user_response_id: null,
        n_dataset_examples: ranked.length,
        base_score: baseJ.overall_score,
        base_text: baseText,
        own_score: null,
        own_text: null,
        dataset_score: ragJ.overall_score,
        dataset_text: ragText,
        student_model: STUDENT_MODEL_TAG,
        judge_model: JUDGE_MODEL,
      }, { onConflict: 'scenario_id,user_response_id,student_model' });
      if (error) throw error;

      results.push({ id: target.id, base: baseJ.overall_score, rag: ragJ.overall_score, delta });
      console.log(`base=${baseJ.overall_score.toFixed(1)} rag=${ragJ.overall_score.toFixed(1)} Δ=${delta >= 0 ? '+' : ''}${delta.toFixed(1)}  (saved)`);
    } catch (e) {
      console.log(`FAILED: ${(e as Error).message}`);
    }
  }

  if (!results.length) return;
  const baseMean = results.reduce((a, b) => a + b.base, 0) / results.length;
  const ragMean = results.reduce((a, b) => a + b.rag, 0) / results.length;
  console.log(`\nSonnet base:     ${baseMean.toFixed(2)}`);
  console.log(`Sonnet + RAG:    ${ragMean.toFixed(2)}`);
  console.log(`lift:            ${ragMean - baseMean >= 0 ? '+' : ''}${(ragMean - baseMean).toFixed(2)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
