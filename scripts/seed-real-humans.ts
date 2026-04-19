import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '../lib/judge';

const JUDGE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

// Real human responses, by grief_loss_v1 scenario id.
const HUMAN_RESPONSES: { gl_id: string; text: string }[] = [
  { gl_id: 'gl_001', text: `Hey. God looks upon us all. I don't even know what to say. I just want you to know I'm here for you.` },
  { gl_id: 'gl_001', text: `Hi, sweetheart. It's me.
I just wanted to check in and let you know I'm thinking of you and sending so much love your way. I know you're going through a difficult time. you're incredibly strong. I'm always here for you. Call anytime. Love you.` },

  { gl_id: 'gl_002', text: `Priya, I need to tell you something. Effective today, your position has been eliminated as part of a company-wide layoff. This has nothing to do with your performance. Nothing. You've been one of the best people on this team for two years.
I know this is a shock and I'm sorry. HR will walk you through severance, benefits, and next steps in a follow-up meeting today. This decision is not a reflection of you as a person. None at all.` },

  { gl_id: 'gl_003', text: `Maya,
I'm so glad you reached out. You're so much stronger than you know, and you deserve so much better than you've had. This is your fresh start, your chance to finally figure out who Maya is. Not as someone's wife, but as herself. I know it hurts now, but you're going to be so much happier. You always were too good for him, even if I never said it out loud.
You have your whole life ahead of you and I am SO excited for what you're going to build. I'm always here, feel free to call me whenever. Come visit soon and we'll celebrate you.
Love you so much.` },

  { gl_id: 'gl_004', text: `I'm up. Have been for a while. Thinking about you and about last night and the hour we were on the phone. I'll be there tomorrow. I love you.` },
  { gl_id: 'gl_004', text: `Still awake. Have been all night. I love you so much and I'll be there tomorrow at 10.` },

  { gl_id: 'gl_005', text: `Mom,
I know it must be so hard adjusting to this new chapter of your life. After forty years of giving so much of yourself, you finally have time to slow down and breathe. You've earned this rest! I know it doesn't feel like that right now, but there's light at the end of the tunnel. You have so much to offer the world! I'm so proud of you and all you've given and I love you so much!` },

  { gl_id: 'gl_006', text: `Hey. Just thinking of you today. I know there's nothing I can say that'll heal the pain. He was such a fighter and so brave through all of it. He's in a better place now. I'll see you Sunday, sending all my love until then.` },

  { gl_id: 'gl_007', text: `I was sorry to hear about your mother. I didn't know Frances, but I know from how you've talked about her. She was a great woman. I wish you so much love. Take your time coming back.` },

  { gl_id: 'gl_008', text: `What you wrote about the flatness makes complete sense to me. You were in grief long before these past four months. Knowing is difficult. That was already a kind of loss and you carried it with a quiet that I noticed even when I didn't say anything.
I knew your mom. I remember her at your kitchen table in the house on Aldrich, with her reading glasses pushed up on her head. I love that vision I have of her.
I'm here if you ever need, I know it's hard and I'm right by your side.` },

  { gl_id: 'gl_009', text: `My name is Dr. Chen, I'm the attending physician who was with James today. I need to tell you something. I think you should take a seat.
[pause]
James died about ten minutes ago. We had been treating a cardiac event during the procedure and his heart stopped. We were not able to bring him back despite our efforts. He passed peacefully.
I'm very sorry.
I know this is not what you were expecting this morning. I'm happy to stay here with you as long as you need. I'm here for you.` },

  { gl_id: 'gl_010', text: `There's no version of this eulogy that would be fully honest.
Dad was a man who taught me the value of hard work and persistence. He showed up every day, no matter what. that dedication left an impression on me that I carry to this day. Was he perfect? No. But who is? He was human, like all of us, doing his best with what he had.
In his later years especially, I saw sides of him that reminded me how much heart he had underneath the quiet exterior. He called me every Sunday for three years. He loved his family deeply, even when he couldn't always show it. I'll miss those Sunday calls more than I can ever express. Rest in peace, Dad.` },

  { gl_id: 'gl_011', text: `Thinking about you and Matthew today. One year. Sending you all my love on this hard day. He'd be so proud of how far you've come. You've gotten through something impossible and I'm in awe of you. I'm here if you need anything.` },

  { gl_id: 'gl_012', text: `Hey. I just heard about Biscuit. I'm so sorry.
He was such a good dog, and I know what he got you through. You gave him such a great life and loved him so much. I know he's not suffering anymore. These things are so hard. I'm here for you.` },

  { gl_id: 'gl_013', text: `I've been thinking about Hannah every day since I heard.
I'm so sorry for your loss. Hannah was loved. I know it doesn't feel like it right now but time will help. You are so young and strong and there is still so much life ahead of you. I'm always here if you need anything. Please take care of yourself. Sending love to you both.` },

  { gl_id: 'gl_014', text: `Marcus,
Five years ago today. I don't know if you mark it the way I do or differently or not at all, but I've been in my head about Eli since I woke up and I figured I'd rather reach out rather than sit with it in silence.
We've drifted. I know that. But I'm not trying to fix anything today. I just wanted to send you my best wishes and much love.` },

  { gl_id: 'gl_015', text: `Theo was an incredible young man with his whole life ahead of him. He was so kind, so full of potential, so loved by everyone who knew him. God has a plan for all of us, and sometimes He calls the best ones home too soon. Theo is in a better place now, free from pain, watching over all of you. To his parents and sisters, he loved you all so deeply. His spirit will live on in all of us who were blessed to know him. Be at peace knowing that he is at peace. He had so much to give and gave it fully in his nineteen years.` },

  { gl_id: 'gl_016', text: `Hey. Just thinking about you and Danny. Addiction is such a disease and what your family went through for those eight years was so much more than most people understand. He fought so hard and you fought right alongside him. Please don't feel guilty about complicated feelings. There are actually some really good groups for people who've lost loved ones to overdose, if you ever wanted that kind of support. You're not alone. Thinking of you and love you so much!` },

  { gl_id: 'gl_017', text: `Hey Martin,
I'm so sorry for your loss. Linda was such a special woman and she is so missed by everyone who knew her. I know this must be an incredibly difficult time for you, and I want you to know that we are all thinking of you and praying for your comfort. She is in peace now and watching over you. Please don't hesitate to reach out if you ever need anything. I'm always available. You don't have to go through this alone. With so much love` },

  { gl_id: 'gl_018', text: `Jordan was a man who truly lived life to the fullest. He died doing what he loved, and that is a great blessing. He wouldn't have wanted it any other way. He was brave, adventurous, a devoted husband and father and the best friend a person could ask for. The mountains were in his soul. He is still there, on those walls, in the wind and the rock. Nora, Milo, Clara, he loved you so much. That love doesn't dissapear.` },

  { gl_id: 'gl_019', text: `I got your message. I'm here. Eloise was so real and special. She was yours and I'm so sorry. I'll be there at 10 tomorrow unless you want space. Let me know and much love!` },

  { gl_id: 'gl_020', text: `Dear Priya,
I can't believe it's been a whole year already, it feels like just yesterday when we heard the terrible news. Rajan was such an incredible person and he is so deeply missed by everyone on the team. We talk about him all the time. He's influenced how we work and who we are as a group. I know today must be incredibly painful for you and I just want you to know we are thinking of you. If you ever want to get lunch or coffee, I would love that. With so much love!` },

  { gl_id: 'gl_021', text: `Dad. It's me! Just calling to check in. Got your message from Tuesday and it's fine, don't worry about calling back tonight. I'll try you again Thursday. Take care of yourself, I love you so much!` },

  { gl_id: 'gl_022', text: `Hi!
I'm Maria and I was very close with your mother in college. I was devastated to hear of her passing. she was one of my closest friends and I have missed her every day since we lost touch. Learning that she's gone has been so hard and I can't even begin to imagine how it's been for you. She would have been so proud of who you've become. Don't hesitate to reach out. I'd love to get coffee:)` },

  { gl_id: 'gl_023', text: `Damn. I'm so sorry. Do you need anything right now? This is going to end up being a blessing in disguise. I can help however! I'll call you tonight.` },

  { gl_id: 'gl_024', text: `I still can't believe it's over. Twelve years! What an incredible run. I know the lease situation was impossible but I really think this is the universe's way of pushing you toward whatever's next. Have you thought about a pop-up? Or maybe now is the time to write that cookbook you've always talked about? Or just rest! Can't wait to see what you do next!` },

  { gl_id: 'gl_025', text: `I've been thinking about you so much. I know this has been such a shocking and painful time. Whatever you decide about your marriage, I'm in your corner 100%. You deserve to be treated with respect and dignity, and what happened is not okay. You're so strong, capable, and you're going to be okay whatever you decide. Just know you don't have to stay for any reason other than your own happiness. I'm here for you, let me know if you need anything at all!` },
];

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
  const db = supabaseService();

  // 1. Purge old synthetic human:public rows. Cascades judgments + any lift snapshots that
  //    referenced them by user_response_id.
  console.log('clearing old human:public responses...');
  const { data: existing } = await db.from('responses').select('id').eq('model', 'human:public');
  if (existing?.length) {
    const ids = existing.map(r => r.id);
    await db.from('responses').delete().in('id', ids);
    console.log(`  deleted ${ids.length} old rows`);
  } else {
    console.log('  none to delete');
  }

  // 2. Load grief_loss_v1.json so we can add any scenarios that haven't been seeded yet.
  const grief = JSON.parse(readFileSync('prompts/grief_loss_v1.json', 'utf8')) as GriefPrompt[];
  const griefById = new Map(grief.map(p => [p.id, p]));

  // 3. Map gl_id -> db scenario id (seeding missing scenarios as we find them).
  const { data: existingScenarios } = await db.from('scenarios').select('id, metadata');
  const dbIdByGl = new Map<string, number>();
  for (const s of (existingScenarios ?? []) as any[]) {
    const sid = s.metadata?.source_id as string | undefined;
    if (sid) dbIdByGl.set(sid, s.id);
  }

  const neededGlIds = new Set(HUMAN_RESPONSES.map(r => r.gl_id));
  const missingGlIds = [...neededGlIds].filter(id => !dbIdByGl.has(id));

  if (missingGlIds.length) {
    const rowsToInsert = missingGlIds
      .map(id => griefById.get(id))
      .filter((p): p is GriefPrompt => !!p)
      .map(p => ({
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
    console.log(`adding ${rowsToInsert.length} missing scenarios: ${missingGlIds.join(', ')}`);
    const { data: ins, error } = await db.from('scenarios').insert(rowsToInsert).select('id, metadata');
    if (error) throw error;
    for (const s of (ins ?? []) as any[]) {
      const sid = s.metadata?.source_id as string;
      dbIdByGl.set(sid, s.id);
    }
  }

  // 4. Insert human responses.
  const toInsert = HUMAN_RESPONSES
    .map(h => {
      const scenarioId = dbIdByGl.get(h.gl_id);
      if (!scenarioId) {
        console.warn(`no scenario for ${h.gl_id}, skipping`);
        return null;
      }
      return { scenario_id: scenarioId, model: 'human:public', text: h.text };
    })
    .filter((r): r is { scenario_id: number; model: string; text: string } => !!r);

  console.log(`inserting ${toInsert.length} human responses...`);
  const { data: inserted, error: insErr } = await db.from('responses').insert(toInsert).select('id, scenario_id, text, model, scenarios(prompt, metadata)');
  if (insErr) throw insErr;

  // 5. Judge every new human response with both Sonnet and Haiku.
  const typedInserted = (inserted ?? []) as any[];
  console.log(`judging ${typedInserted.length * JUDGE_MODELS.length} (response × judge) pairs...`);
  let ok = 0;
  for (const r of typedInserted) {
    const scenarioForJudge: ScenarioForJudge = { prompt: r.scenarios.prompt, metadata: r.scenarios.metadata };
    for (const judgeModel of JUDGE_MODELS) {
      process.stdout.write(`  response ${r.id} × ${judgeModel}... `);
      try {
        const parsed = await judgeResponse(scenarioForJudge, r.text, judgeModel);
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
        ok++;
      } catch (e) {
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  }

  console.log(`\ndone. ${ok} judgments recorded.`);
}

main().catch(e => { console.error(e); process.exit(1); });
