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

  return {
    scenarios: scenarios ?? 0,
    sftEligible,
    dpoPairs,
    rawRows: (allResponses ?? []).length,
  };
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
    <article className="grid grid-cols-[44px_1fr_220px] gap-6 py-7 border-b border-rule items-start">
      <span className="font-mono text-xs tabular-nums text-ink-whisper pt-1">{numeral}</span>
      <div className="space-y-2 max-w-[42rem]">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3
            className="font-display text-[1.3rem] text-ink-deep"
            style={{ fontVariationSettings: '"SOFT" 0, "opsz" 24, "wght" 520' }}
          >
            {title}
          </h3>
          <p className="label">{format}</p>
        </div>
        <p className="text-ink-soft leading-[1.65] text-[0.92rem]">{description}</p>
        <p className="text-xs text-ink-faint font-mono tabular-nums pt-1">
          n = {count} row{count === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex justify-end">
        {count > 0 ? (
          <a
            href={href}
            download={filename}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper-raised hover:bg-accent-deep transition font-display text-[0.95rem]"
            style={{ fontVariationSettings: '"SOFT" 0, "wght" 450' }}
          >
            <span className="label text-paper-raised opacity-70">↓</span>
            <span>.jsonl</span>
          </a>
        ) : (
          <span className="inline-flex items-center px-5 py-2.5 border border-rule-soft text-ink-whisper font-display text-[0.88rem]">
            insufficient data
          </span>
        )}
      </div>
    </article>
  );
}

export default async function ExportPage() {
  const stats = await loadStats();

  return (
    <main className="min-h-screen page-fade">
      <div className="max-w-[64rem] mx-auto px-8 md:px-16 pt-14 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-14 border-b border-rule">
          <Link href="/dataset" className="label hover:text-ink transition">← Corpus</Link>
          <div className="label">Appendix B · Download</div>
        </header>

        <section className="max-w-[44rem] mb-14">
          <p className="section-number mb-2">Appendix B.</p>
          <h1
            className="font-display text-ink-deep text-[2.6rem] md:text-[3rem] leading-[1.05] mb-5"
            style={{ fontVariationSettings: '"SOFT" 0, "opsz" 144, "wght" 420' }}
          >
            Downloads, in five training-ready formats.
          </h1>
          <p className="text-ink-soft text-[0.98rem] leading-[1.7]">
            Each file is generated on request from current database state. The corpus is released
            for research use. Intended downstream uses: supervised fine-tuning, preference-based RL
            (DPO, IPO, KTO), and calibration of judge-model agreement. Drop files directly into{' '}
            <code className="font-mono text-sm bg-paper-sunk border border-rule-hair px-1.5 py-0.5">trl.DPOTrainer</code>,{' '}
            <code className="font-mono text-sm bg-paper-sunk border border-rule-hair px-1.5 py-0.5">openai.fine_tuning.jobs.create</code>,
            Axolotl, or LLaMA-Factory.
          </p>
        </section>

        <section className="border-t border-rule">
          <DownloadRow
            numeral="B.1"
            title="SFT · chat format"
            format="OpenAI · HF · TRL SFTTrainer"
            description={`JSONL of { messages: [{role:"user"}, {role:"assistant"}] } for every public human response that scored ≥ ${SFT_SCORE_THRESHOLD}/100 on at least one judge.`}
            count={stats.sftEligible}
            href="/api/export/sft"
            filename="the-soul-problem-sft.jsonl"
          />
          <DownloadRow
            numeral="B.2"
            title="SFT · ShareGPT"
            format="Axolotl · LLaMA-Factory"
            description="Same threshold, ShareGPT conventions: { conversations: [{from, value}] }."
            count={stats.sftEligible}
            href="/api/export/sharegpt"
            filename="the-soul-problem-sharegpt.jsonl"
          />
          <DownloadRow
            numeral="B.3"
            title="SFT · Alpaca"
            format="Stanford Alpaca · LoRA tutorials"
            description="{ instruction, input, output } per line. Common for smaller-scale LoRA work."
            count={stats.sftEligible}
            href="/api/export/alpaca"
            filename="the-soul-problem-alpaca.jsonl"
          />
          <DownloadRow
            numeral="B.4"
            title="DPO · preference pairs"
            format="TRL DPOTrainer"
            description={`JSONL of { prompt, chosen, rejected } where chosen beats rejected by at least ${DPO_MIN_DELTA} points on the same scenario.`}
            count={stats.dpoPairs}
            href="/api/export/dpo"
            filename="the-soul-problem-dpo.jsonl"
          />
          <DownloadRow
            numeral="B.5"
            title="Raw"
            format="Full dump · bring your own loss"
            description="Every scenario, every response, every per-criterion judgment with rationales. For researchers writing their own aggregation or objective."
            count={stats.rawRows}
            href="/api/export/raw"
            filename="the-soul-problem-raw.jsonl"
          />
        </section>

        <section className="mt-16 border-y border-rule py-8">
          <p className="section-number mb-2">§ Licensing</p>
          <p className="text-ink-soft leading-[1.7] text-[0.92rem] max-w-[44rem]">
            The corpus is released for research use. Contributors consented to public release under
            anonymous attribution. Intended downstream uses do not include training systems
            optimized to deceive or manipulate emotionally vulnerable users. Downstream uses that
            strip emotional context are contrary to the corpus&apos;s intent.
          </p>
        </section>

        <footer className="pt-10 flex flex-wrap gap-3">
          <Link href="/try" className="px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 0, "wght" 450' }}>
            Add to the corpus
          </Link>
          <Link href="/leaderboard" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 0, "wght" 400' }}>
            Results
          </Link>
        </footer>
      </div>
    </main>
  );
}
