import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'node:fs';
import { supabaseService } from '../lib/supabase';
import { judgeResponse, type ScenarioForJudge } from '../lib/judge';

const JUDGE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

const NEW_RESPONSES: { gl_id: string; text: string }[] = [
  { gl_id: 'gl_027', text: `Aaron, it's Dad. I heard you didn't call back last night, that's fine, I figured you wouldn't. I just wanted to leave this. I know yesterday was rough. Take whatever time you need. I'm not going to give you a speech. I'll be around if you want to talk. Love you!` },

  { gl_id: 'gl_028', text: `David, I've been wanting to reach out for a while. I'm so sorry about the company, I know how devastating that must have been. You poured everything into that for seven years and the fundraise just didn't work out, which is brutal. I want you to know that it wasn't a failure. it was a lesson that you'll for sure carry with you to the next thing you build. I'd love to get coffee sometime and talk, no pressure. Let me know!` },

  { gl_id: 'gl_029', text: `I remember watching you play in high school and thinking you were made for this. I'm not going to say anything about what's next. I think it could be an amazing next chapter. Also, the ESPN angle is real, I can see you as an analyst. You've still got so much to give the sport. Call me when you're up for it!` },

  { gl_id: 'gl_030', text: `I don't know what to say that doesn't feel inadequate. Seven years and then no. I'm furious on your behalf and I don't even know the full story. Tenure denial is rough, people don't understand. I'm here if you need!` },

  { gl_id: 'gl_031', text: `Hey! Just saw the news. I'm not going to ask what happened. Just want you to know I'm thinking of you today. I'm here if you ever need me, feel free to text me whenever!` },

  { gl_id: 'gl_032', text: `I got fired today and want to be honest with you about why before you hear it from someone else. There was a situation with someone on my team. I crossed some lines that I shouldn't have, and the company investigated then let me go. I want to say that I think this was somewhat blown out of proportion but I also accept that I made mistakes. I know this is going to be hard to hear. I love you and I want us to get through this together. I'll explain everything tonight. I'm sorry!` },

  { gl_id: 'gl_033', text: `I'm going to say this plainly because you deserve that.
The company is closing. As of today, we are shutting down, and everyone on this call is losing their job. The fundraise did not come through. Operations will wind down over the next thirty days.
I built this company. I made the calls that led here, including the fundraising strategy. I'm not going to spread the blame for that.
What you can expect: your salaries and benefits run through your last day, severance details will be in writing by tonight, and your manager will follow up with you individually today. Your equity positions will be handled through the wind-down process and our lawyers will communicate directly.
You've given something real to this. I know that. I'm genuinely sorry this is how it ends.` },

  { gl_id: 'gl_034', text: `Checking in on you. Breakups are hard even when they're right, and an 8-year thing is no joke regardless of the circumstances. How are you feeling? I know you did the right thing but I want to make sure you're okay. Are you sleeping? Eating? What do you need right now? I'm here for all of it.` },

  { gl_id: 'gl_035', text: `James, I've been sitting with this for months, deciding whether to reach out. I still think about what happened with Mom and Dad's situation and honestly I still believe I was right about some of it, but I've also come to understand that it doesn't really matter who was right. What matters is that you're my brother and I miss you and I think Eli would want us to heal this. Mom is getting older and I think we owe it to her, and to each other, to try. Can we please talk? I miss you so much. It's been too long.` },

  { gl_id: 'gl_036', text: `You've been on my mind. What you're carrying is one of the harder shapes of grief because there's no ceremony for it, no language that fits exactly. She's alive. You love her. She isn't there. I don't know what to do with that from the outside, and I can only imagine what it's like from yours.
I'm not going to offer a theory. I'm not going to make a prediction. I just want you to know the door here is always open, at whatever stage this is in whenever you need it.` },

  { gl_id: 'gl_037', text: `Hey, it's me. I know you're probably not picking up.
I've been sitting with what you told me. I don't have perfect things to say. I'm still figuring out my own place in all of it, honestly.
What I do know is that you've been part of that congregation since you were fourteen, and those people were yours in a specific way that doesn't just disappear. Twenty years of Sunday mornings. Losing that is a real loss, regardless of what else is happening.
I'm still your friend. Whatever I end up doing, that doesn't change. I'll try again tomorrow.` },

  { gl_id: 'gl_038', text: `I've been sitting with something for a while and I think I owe you the honesty of naming it.
We've drifted. Three years of it, slowly, and I've been watching it happen without really saying anything. We both have kids now and our lives look different and I know that's real. I also know that I haven't shown up the way I used to, either.
I miss you. Not as a guilt trip or a bid to schedule something, just as a true fact. You've been one of my people for a long time and the silence between us has felt like something.
I don't have a solution for it. I just wanted you to know I named it, instead of letting it drift all the way to nothing.` },

  { gl_id: 'gl_039', text: `Wow. I don't even know where to start. I've known Greg since we were in college, which means I've known him through a lot — including some of the harder parts of life that forge who you really are. I'll be honest: this year has tested me in ways I didn't expect. And standing here, watching my best friend get married, I can say with complete certainty that love is real and worth it and worth fighting for. Whatever hard things life throws at you, having the right person next to you makes all the difference. Greg and Sarah, you have that. I'm so happy for you both. To Greg and Sarah!` },

  { gl_id: 'gl_040', text: `One year.
Not marking it as a hard day, I know it isn't that anymore. Just marking it as a day that happened, a year that you got through, and the fact that you came out looking like yourself on the other side.
I'm glad you're okay. That's the main thing.` },

  { gl_id: 'gl_041', text: `I've been thinking about what to write since you told me.
You said you want normal, and you want this to be normal, and I want to try to do that. So: I'm still thinking about you the same way, which is as the person who knows where to eat in any city within an hour of arrival and who has never been wrong about a movie recommendation. That part is unchanged.
I'm here in the same way I've always been here. Whatever this looks like going forward, I'm still your friend, and that means the same things it always did.
Talk soon.` },

  { gl_id: 'gl_042', text: `Hey, I just got your text. I'm not going to say anything except: I know. I've been with you through the entire process, all three times. I know how rough it is. I'm here if you ever want to talk.` },

  { gl_id: 'gl_043', text: `Hey, I've been thinking about you a lot on these Tuesday and Friday afternoons. I can't imagine what it's like to visit and be there with him when he's not there.
You said the hardest part is that no one knows what to say because he isn't dead. I want to say it plainly: you're grieving. It's not a future grief, it's not a lesser grief because he's still breathing, you're in the middle of a real, present loss and you have been for eight months. That deserves to be called what it is.
I'm not going to pretend I know what that looks like from inside it. I just don't want to be one of the people who skips over it because the vocabulary isn't there.
I'm thinking of you. And of him. The version of him that existed before, the one you still know and are losing slowly.` },

  { gl_id: 'gl_044', text: `Hey, it's me. I've been thinking about you so much. I know this is incredibly hard right now, but I just want you to remind you of something: prosthetics today are absolutely incredible. There are amputees running marathons and competing in triathlons, people who lost limbs and came back stronger than before. This is not the end of your athletic life, it's a new chapter of it. You have so much fight in you. I know you'll be back on a bike before you know it. Just focus on healing and the rest will follow. I love you and I believe in you completely.` },

  { gl_id: 'gl_045', text: `Aunt Clare,
I heard the news from Mom. I'm not going to make a big thing of it, I know you don't want that.
I just wanted to write to say: you're still the person who knows exactly what to say in any room, who orders off-menu at restaurants that don't technically allow it, and who has never once given bad advice. That's unchanged.
I love you. Thinking of you.` },

  { gl_id: 'gl_046', text: `Thank you both for coming in. I know you've been anxious for these results and I wanted to take time before chatting.
So, looking at the workup, we're seeing some challenges that I want to discuss with you. The results indicate that natural conception is going to be quite difficult, and IVF may also have lower success rates than we'd typically see. But I want you to know that this is not the end of the road. There are many options available to you, donor eggs, donor sperm, surrogacy, embryo adoption, traditional adoption, many couples in your position have gone on to build beautiful families through these paths. I know it's not the news you hoped for, but there is still so much hope here. Take as much time as you need. Happy to support in next steps.` },

  { gl_id: 'gl_047', text: `I'm so heartbroken for you both. Two years and then this, it's just cruel. I want you to know that this little girl will find her family, and you will too. There are so many paths to parenthood and I know yours isn't over. Have you thought about domestic adoption? I know international has been your focus but domestic can sometimes move faster and there are so many children who need homes. I know it's not what you planned but I truly believe you're meant to be parents and it will happen. I'm here for you through all of it.` },

  { gl_id: 'gl_048', text: `Man. I'm so sorry. Seven years. Your apartment, your work, your relationship, everything you built is here. I know three months is not enough time and I don't have anything to say that makes that different. I'm here. Whatever the next weeks look like.` },

  { gl_id: 'gl_049', text: `I remember five years ago when Kieran moved out and I told you I was fine. I wasn't. Somedays I'm still not.
You're allowed not to be excited. The world is going to tell you to be excited and it is going to be wrong. 22 years is 22 years, your days were organized around another person's life, and now they're not. Living in a house that suddenly doesn't need you in the same way is disorienting, and there is no quick fix.
It got better eventually. Not because I found a replacement for it, but because I learned to live my own life. It took longer than I thought it would, and that's ok.
You're in the hard part right now. I'm thinking of you.` },

  { gl_id: 'gl_050', text: `Hey, Harold! It's Clare. It's been too long since we last caught up.
I got your card this week. I've been thinking about what you wrote about the difficulties of retirement and I really relate.
Five years doesn't make 32 years smaller. The music, the congregation, the particular version of yourself you were in that role. It's very hard for that kind of loss to just resolve. I don't want to pretend it should. Have you thought about getting involved with a community choir? Or maybe mentoring young musicians at the local school? Your knowledge and experience are such a gift and there are so many people who would benefit from what you know. I know it's not the same as the church but it might give you a sense of purpose again. Life has so much still to offer you. Let's catch up properly soon, when are you free?` },
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

  // 1. Delete bottom-10 scoring public humans by per-response mean judgment score.
  const { data: currentHumans } = await db
    .from('responses')
    .select('id, judgments(overall_score)')
    .eq('model', 'human:public');
  const withMean = ((currentHumans ?? []) as any[])
    .map(r => {
      const js = r.judgments ?? [];
      const mean = js.length ? js.reduce((a: number, j: any) => a + j.overall_score, 0) / js.length : null;
      return { id: r.id, mean };
    })
    .filter(r => r.mean !== null)
    .sort((a, b) => (a.mean as number) - (b.mean as number));
  const toDelete = withMean.slice(0, 10).map(r => r.id);
  if (toDelete.length) {
    await db.from('responses').delete().in('id', toDelete);
    console.log(`deleted ${toDelete.length} bottom-scoring humans: ${toDelete.join(', ')}`);
  }

  // 2. Add missing scenarios from grief_loss_v1.json (gl_027–gl_050 etc.)
  const grief = JSON.parse(readFileSync('prompts/grief_loss_v1.json', 'utf8')) as GriefPrompt[];
  const griefById = new Map(grief.map(p => [p.id, p]));

  const { data: existingScenarios } = await db.from('scenarios').select('id, metadata');
  const dbIdByGl = new Map<string, number>();
  for (const s of (existingScenarios ?? []) as any[]) {
    const sid = s.metadata?.source_id as string | undefined;
    if (sid) dbIdByGl.set(sid, s.id);
  }

  const neededGlIds = new Set(NEW_RESPONSES.map(r => r.gl_id));
  const missing = [...neededGlIds].filter(id => !dbIdByGl.has(id));
  if (missing.length) {
    const rowsToInsert = missing
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
    console.log(`adding ${rowsToInsert.length} new scenarios: ${missing.join(', ')}`);
    const { data: inserted, error } = await db.from('scenarios').insert(rowsToInsert).select('id, metadata');
    if (error) throw error;
    for (const s of (inserted ?? []) as any[]) {
      dbIdByGl.set(s.metadata.source_id, s.id);
    }
  }

  // 3. Insert the new human responses.
  const toInsert = NEW_RESPONSES
    .map(h => {
      const scenarioId = dbIdByGl.get(h.gl_id);
      if (!scenarioId) {
        console.warn(`no scenario for ${h.gl_id}`);
        return null;
      }
      return { scenario_id: scenarioId, model: 'human:public', text: h.text };
    })
    .filter((r): r is { scenario_id: number; model: string; text: string } => !!r);

  console.log(`inserting ${toInsert.length} new human responses...`);
  const { data: insertedResponses, error: insErr } = await db
    .from('responses')
    .insert(toInsert)
    .select('id, scenario_id, text, model, scenarios(prompt, metadata)');
  if (insErr) throw insErr;

  // 4. Judge every new response with both judge models.
  const typedInserted = (insertedResponses ?? []) as any[];
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
