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

  return { scenarios: scenarios ?? 0, sftEligible, dpoPairs, rawRows: (allResponses ?? []).length };
}

function DownloadRow({
  title,
  format,
  description,
  count,
  href,
  filename,
}: {
  title: string;
  format: string;
  description: string;
  count: number;
  href: string;
  filename: string;
}) {
  return (
    <article className="grid grid-cols-[1fr_200px] gap-6 py-6 border-b border-rule-soft items-center">
      <div className="space-y-2 max-w-[42rem]">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3
            className="font-display text-[1.25rem] text-ink-deep"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 550' }}
          >
            {title}
          </h3>
          <p className="tag">{format}</p>
        </div>
        <p className="text-ink-soft leading-[1.65] text-[0.92rem]">{description}</p>
        <p className="text-xs text-ink-faint font-mono tabular-nums pt-1">
          {count} row{count === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex justify-end">
        {count > 0 ? (
          <a
            href={href}
            download={filename}
            className="inline-block px-5 py-2.5 bg-ink text-paper-raised hover:bg-accent-deep transition font-display text-[0.95rem]"
            style={{ fontVariationSettings: '"SOFT" 30, "wght" 500' }}
          >
            Download .jsonl
          </a>
        ) : (
          <span className="inline-block px-5 py-2.5 border border-rule-soft text-ink-faint font-display text-[0.88rem]">
            Not enough data
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
      <div className="max-w-[62rem] mx-auto px-8 md:px-14 pt-12 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-12 hairline">
          <Link href="/dataset" className="font-display text-ink-deep text-[1.05rem]" style={{ fontVariationSettings: '"SOFT" 30, "wght" 600' }}>
            ← Corpus
          </Link>
          <div className="text-[0.92rem] text-ink-soft">Download</div>
        </header>

        <section className="max-w-[44rem] mb-12">
          <h1
            className="font-display text-ink-deep text-[2.4rem] md:text-[2.9rem] leading-[1.05] mb-5"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 420' }}
          >
            Download the dataset.
          </h1>
          <p className="text-ink-soft text-[1.02rem] leading-[1.65]">
            Five training-ready formats. Each file is generated live from the database on click.
            Drop directly into{' '}
            <code className="font-mono text-sm bg-paper-sunk border border-rule-hair px-1.5 py-0.5">trl.DPOTrainer</code>,{' '}
            <code className="font-mono text-sm bg-paper-sunk border border-rule-hair px-1.5 py-0.5">openai.fine_tuning.jobs.create</code>,
            Axolotl, or LLaMA-Factory.
          </p>
        </section>

        <section className="border-t border-rule">
          <DownloadRow
            title="SFT · chat format"
            format="OpenAI · HuggingFace · TRL"
            description={`Public human responses scoring ≥ ${SFT_SCORE_THRESHOLD}/100, as { messages: [...] } per line.`}
            count={stats.sftEligible}
            href="/api/export/sft"
            filename="the-soul-problem-sft.jsonl"
          />
          <DownloadRow
            title="SFT · ShareGPT"
            format="Axolotl · LLaMA-Factory"
            description="Same threshold. { conversations: [...] } format."
            count={stats.sftEligible}
            href="/api/export/sharegpt"
            filename="the-soul-problem-sharegpt.jsonl"
          />
          <DownloadRow
            title="SFT · Alpaca"
            format="Stanford Alpaca · LoRA"
            description="{ instruction, input, output } per line. Common for smaller LoRA work."
            count={stats.sftEligible}
            href="/api/export/alpaca"
            filename="the-soul-problem-alpaca.jsonl"
          />
          <DownloadRow
            title="DPO · preference pairs"
            format="TRL DPOTrainer"
            description={`{ prompt, chosen, rejected }, where chosen beats rejected by ≥ ${DPO_MIN_DELTA} points on the same scenario.`}
            count={stats.dpoPairs}
            href="/api/export/dpo"
            filename="the-soul-problem-dpo.jsonl"
          />
          <DownloadRow
            title="Raw"
            format="Everything"
            description="Every scenario, every response, every per-criterion judgment with rationales."
            count={stats.rawRows}
            href="/api/export/raw"
            filename="the-soul-problem-raw.jsonl"
          />
        </section>

        <section className="mt-14 border-y border-rule py-7">
          <h3 className="font-display text-ink-deep text-[1.15rem] mb-2" style={{ fontVariationSettings: '"SOFT" 30, "wght" 550' }}>
            Licensing
          </h3>
          <p className="text-ink-soft leading-[1.65] text-[0.93rem] max-w-[44rem]">
            Released for research use. Contributors consented to public release under anonymous
            attribution. Please do not use the corpus to train systems that manipulate emotionally
            vulnerable users.
          </p>
        </section>

        <footer className="pt-10 flex flex-wrap gap-3">
          <Link href="/try" className="px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 500' }}>
            Add to the corpus
          </Link>
          <Link href="/leaderboard" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 450' }}>
            Leaderboard
          </Link>
        </footer>
      </div>
    </main>
  );
}
