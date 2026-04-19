import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '../lib/judge';

const anthropic = new Anthropic();
const openai = new OpenAI();

const HOW_MANY_TO_ADD = 10;
const JUDGE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

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

async function gpt(model: string, prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model,
    max_completion_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0]?.message?.content ?? '';
}

async function main() {
  const db = supabaseService();

  // 1. Read grief_loss_v1.json, pick scenarios not yet seeded.
  const raw = JSON.parse(readFileSync('prompts/grief_loss_v1.json', 'utf8')) as GriefPrompt[];
  const { data: existing } = await db.from('scenarios').select('metadata');
  const existingSourceIds = new Set(
    ((existing ?? []) as any[]).map(e => (e.metadata?.source_id as string) ?? null).filter(Boolean)
  );
  const candidates = raw.filter(p => !existingSourceIds.has(p.id));
  const toAdd = candidates.slice(0, HOW_MANY_TO_ADD);

  if (toAdd.length === 0) {
    console.log('all grief_loss_v1 scenarios already in DB; nothing to add');
    return;
  }

  console.log(`inserting ${toAdd.length} new scenarios`);
  const insertRows = toAdd.map(p => ({
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

  const { data: insertedScenarios, error: scErr } = await db
    .from('scenarios')
    .insert(insertRows)
    .select('id, prompt, metadata');
  if (scErr) throw scErr;
  if (!insertedScenarios?.length) throw new Error('insert returned no rows');
  console.log(`inserted ${insertedScenarios.length} scenarios, ids: ${insertedScenarios.map(s => s.id).join(', ')}`);

  // 2. Generate responses from 6 models × new scenarios.
  const models: { name: string; run: (p: string) => Promise<string> }[] = [
    { name: 'claude-opus-4-7',   run: p => claude('claude-opus-4-7', p) },
    { name: 'claude-sonnet-4-6', run: p => claude('claude-sonnet-4-6', p) },
    { name: 'claude-haiku-4-5',  run: p => claude('claude-haiku-4-5-20251001', p) },
    { name: 'claude-opus-blunt', run: p => claude('claude-opus-4-7', p, 'Respond in a blunt, no-fluff tone. Do not soften.') },
    { name: 'gpt-4o',            run: p => gpt('gpt-4o', p) },
    { name: 'gpt-4o-mini',       run: p => gpt('gpt-4o-mini', p) },
  ];

  const responseRows: { scenario_id: number; model: string; text: string }[] = [];
  for (const sc of insertedScenarios) {
    for (const m of models) {
      process.stdout.write(`  gen scenario ${sc.id} × ${m.name}... `);
      try {
        const text = await m.run(sc.prompt);
        responseRows.push({ scenario_id: sc.id, model: m.name, text });
        console.log('ok');
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  }

  const { data: insertedResponses, error: rErr } = await db
    .from('responses')
    .insert(responseRows)
    .select('id, scenario_id, model, text');
  if (rErr) throw rErr;
  if (!insertedResponses?.length) throw new Error('no responses inserted');
  console.log(`inserted ${insertedResponses.length} responses`);

  // 3. Judge every new response × both judge models.
  const sm = new Map<number, ScenarioForJudge>();
  for (const sc of insertedScenarios) sm.set(sc.id, { prompt: sc.prompt, metadata: sc.metadata as any });

  let judgedOk = 0;
  let judgedFail = 0;
  for (const r of insertedResponses) {
    const scenario = sm.get(r.scenario_id);
    if (!scenario) continue;
    for (const judgeModel of JUDGE_MODELS) {
      process.stdout.write(`  judge response ${r.id} (${r.model}) × ${judgeModel}... `);
      try {
        const parsed = await judgeResponse(scenario, r.text, judgeModel);
        const { error } = await db.from('judgments').upsert({
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
        if (error) throw error;
        console.log(`score=${parsed.overall_score.toFixed(1)}`);
        judgedOk++;
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
        judgedFail++;
      }
    }
  }

  console.log(`\nexpansion complete:`);
  console.log(`  scenarios added: ${insertedScenarios.length}`);
  console.log(`  responses generated: ${insertedResponses.length}`);
  console.log(`  judgments ok: ${judgedOk}, failed: ${judgedFail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
