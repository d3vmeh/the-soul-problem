import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

const SFT_SCORE_THRESHOLD = 75;
const DPO_MIN_DELTA = 5;

async function loadStats() {
  const db = supabaseService();

  const [{ data: publicResponses }, { data: allResponses }, { count: scenarios }] = await Promise.all([
    db.from('responses').select('id, judgments(overall_score)').eq('model', 'human:public'),
    db.from('responses').select('id, scenario_id, judgments(overall_score)'),
    db.from('scenarios').select('*', { count: 'exact', head: true }),
  ]);

  const sftEligible = ((publicResponses ?? []) as any[]).filter(r => {
    const js = r.judgments ?? [];
    if (!js.length) return false;
    return Math.max(...js.map((j: any) => j.overall_score)) >= SFT_SCORE_THRESHOLD;
  }).length;

  const byScenario = new Map<number, number[]>();
  for (const r of ((allResponses ?? []) as any[])) {
    const js = r.judgments ?? [];
    if (!js.length) continue;
    const mean = js.reduce((a: number, j: any) => a + j.overall_score, 0) / js.length;
    const arr = byScenario.get(r.scenario_id) ?? [];
    arr.push(mean);
    byScenario.set(r.scenario_id, arr);
  }
  let dpoPairs = 0;
  for (const means of byScenario.values()) {
    const sorted = [...means].sort((a, b) => b - a);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[i] - sorted[j] >= DPO_MIN_DELTA) dpoPairs++;
      }
    }
  }

  const rawRows = (allResponses ?? []).length;

  return { scenarios: scenarios ?? 0, sftEligible, dpoPairs, rawRows };
}

function DownloadRow({
  numeral,
  title,
  format,
  description,
  count,
  href,
  filename,
}: {
  numeral: string;
  title: string;
  format: string;
  description: string;
  count: number;
  href: string;
  filename: string;
}) {
  return (
    <article className="grid grid-cols-[48px_1fr_240px] gap-6 py-8 border-b border-rule items-start">
      <span className="font-mono text-sm tabular-nums text-ink-whisper pt-2">{numeral}</span>
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <h3
            className="font-display text-[1.6rem] text-ink-deep"
            style={{ fontVariationSettings: '"SOFT" 70, "opsz" 48, "wght" 500' }}
          >
            {title}
          </h3>
          <p className="eyebrow">{format}</p>
        </div>
        <p className="text-ink-soft leading-[1.65] text-[0.97rem] max-w-[42rem]">{description}</p>
        <p className="text-sm text-ink-faint font-mono tabular-nums pt-2">
          {count} example{count === 1 ? '' : 's'} available
        </p>
      </div>
      <div className="flex justify-end">
        {count > 0 ? (
          <a
            href={href}
            download={filename}
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display"
            style={{ fontVariationSettings: '"SOFT" 60, "wght" 450' }}
          >
            <span className="eyebrow text-paper-raised opacity-80">↓</span>
            <span>Download .jsonl</span>
          </a>
        ) : (
          <span className="inline-flex items-center px-6 py-3 border border-rule-soft text-ink-whisper font-display">
            Not enough data yet
          </span>
        )}
      </div>
    </article>
  );
}

export default async function ExportPage() {
  const stats = await loadStats();

  return (
    <main className="min-h-screen">
      <div className="max-w-[68rem] mx-auto px-8 md:px-16 pt-16 pb-24">
        <header className="flex items-baseline justify-between pb-6 mb-16 hairline reveal-in">
          <Link href="/dataset" className="eyebrow hover:text-ink transition">← Archive</Link>
          <div className="eyebrow">Download</div>
        </header>

        <section className="mb-16 reveal-up">
          <p className="eyebrow mb-3">The dataset, in five formats</p>
          <h1
            className="font-display text-ink-deep text-[3.5rem] md:text-[4.5rem] leading-[0.95] mb-6"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 320' }}
          >
            Take it,<br />
            <em className="italic text-accent-deep">train something.</em>
          </h1>
          <p className="text-[1.05rem] leading-[1.7] text-ink-soft max-w-[44rem]">
            Every file below is generated live from the database when you click. Five formats,
            covering the common conventions for supervised fine-tuning, preference-based RL, and
            open research. Drop directly into{' '}
            <code className="font-mono text-sm bg-paper-raised border border-rule-soft px-1.5 py-0.5">trl.DPOTrainer</code>,{' '}
            <code className="font-mono text-sm bg-paper-raised border border-rule-soft px-1.5 py-0.5">openai.fine_tuning.jobs.create</code>,
            Axolotl, LLaMA-Factory, or your own pipeline.
          </p>
        </section>

        <section className="reveal-up" style={{ animationDelay: '0.2s' }}>
          <DownloadRow
            numeral="I"
            title="SFT · chat format"
            format="OpenAI · HuggingFace · TRL"
            description={`Chat-format JSONL. Public human responses that scored ≥ ${SFT_SCORE_THRESHOLD}/100, formatted as { messages: [...] }. The format most SFT tools expect.`}
            count={stats.sftEligible}
            href="/api/export/sft"
            filename="the-soul-problem-sft.jsonl"
          />
          <DownloadRow
            numeral="II"
            title="SFT · ShareGPT"
            format="Axolotl · LLaMA-Factory"
            description={`Same content, ShareGPT conventions. { conversations: [{ from, value }] } per line. Standard for the open-source fine-tune toolchain.`}
            count={stats.sftEligible}
            href="/api/export/sharegpt"
            filename="the-soul-problem-sharegpt.jsonl"
          />
          <DownloadRow
            numeral="III"
            title="SFT · Alpaca"
            format="Instruction format"
            description={`Stanford Alpaca style. { instruction, input, output }. Used by most LoRA tutorials and smaller-scale projects.`}
            count={stats.sftEligible}
            href="/api/export/alpaca"
            filename="the-soul-problem-alpaca.jsonl"
          />
          <DownloadRow
            numeral="IV"
            title="DPO · preference pairs"
            format="TRL · preference-based RL"
            description={`Paired preferences: { prompt, chosen, rejected } where chosen beats rejected by ≥ ${DPO_MIN_DELTA} points on the same scenario. Humans-beat-LLMs pairs are the interesting signal.`}
            count={stats.dpoPairs}
            href="/api/export/dpo"
            filename="the-soul-problem-dpo.jsonl"
          />
          <DownloadRow
            numeral="V"
            title="Raw"
            format="Bring your own loss"
            description="The full dump: every scenario, every response, every per-criterion judgment with rationales. Compute your own aggregation, train your own objective, write your own paper."
            count={stats.rawRows}
            href="/api/export/raw"
            filename="the-soul-problem-raw.jsonl"
          />
        </section>

        <section className="mt-20 border-y border-rule py-10">
          <p className="eyebrow mb-3">Licensing</p>
          <p className="text-ink-soft leading-[1.7] max-w-[44rem]">
            The dataset is released with the understanding that these are emotionally sensitive
            texts. Contributors consented to public release under anonymous attribution. Please do
            not use the corpus to train deceptive or manipulative systems. Downstream uses that
            attempt to strip the emotional context are contrary to the project&apos;s intent.
          </p>
        </section>

        <footer className="pt-10 mt-4 flex flex-wrap gap-3">
          <Link href="/try" className="px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 60, "wght" 450' }}>
            Add to the dataset
          </Link>
          <Link href="/leaderboard" className="px-6 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 80, "wght" 400' }}>
            Leaderboard
          </Link>
        </footer>
      </div>
    </main>
  );
}
