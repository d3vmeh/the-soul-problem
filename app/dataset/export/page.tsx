import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
  title, format, description, count, href, filename,
}: {
  title: string; format: string; description: string; count: number; href: string; filename: string;
}) {
  return (
    <article className="flex items-center gap-4 px-5 py-4 border-b border-line-subtle last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap mb-1">
          <h3 className="font-semibold text-[0.98rem]">{title}</h3>
          <span className="text-[0.78rem] text-faint">{format}</span>
        </div>
        <p className="text-muted text-[0.88rem] leading-[1.55]">{description}</p>
        <p className="font-mono text-xs text-faint tabular-nums mt-1">{count} row{count === 1 ? '' : 's'}</p>
      </div>
      {count > 0 ? (
        <a href={href} download={filename} className="btn btn-primary shrink-0">Download</a>
      ) : (
        <span className="btn btn-secondary opacity-50 cursor-not-allowed shrink-0">Insufficient data</span>
      )}
    </article>
  );
}

export default async function ExportPage() {
  const stats = await loadStats();
  return (
    <main className="min-h-screen fade-in">
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-10 border-b border-line">
          <Link href="/dataset" className="font-semibold tracking-tight text-[0.95rem]">← Dataset</Link>
          <div className="text-[0.85rem] text-muted">Download</div>
        </header>

        <section className="mb-10">
          <h1 className="text-[2rem] font-semibold tracking-tight leading-[1.1] mb-3">Download the dataset.</h1>
          <p className="text-muted leading-[1.55] max-w-2xl">
            Five training-ready formats. Each file is generated live when you click. Drop into{' '}
            <code className="font-mono text-[0.85rem] bg-surface-2 border border-line-subtle px-1.5 py-0.5 rounded">trl.DPOTrainer</code>,{' '}
            <code className="font-mono text-[0.85rem] bg-surface-2 border border-line-subtle px-1.5 py-0.5 rounded">openai.fine_tuning</code>,
            Axolotl, or LLaMA-Factory.
          </p>
        </section>

        <section className="rounded-lg border border-line overflow-hidden mb-10">
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
            description="Same threshold, ShareGPT conventions."
            count={stats.sftEligible}
            href="/api/export/sharegpt"
            filename="the-soul-problem-sharegpt.jsonl"
          />
          <DownloadRow
            title="SFT · Alpaca"
            format="Stanford Alpaca · LoRA"
            description="{ instruction, input, output } per line."
            count={stats.sftEligible}
            href="/api/export/alpaca"
            filename="the-soul-problem-alpaca.jsonl"
          />
          <DownloadRow
            title="DPO · preference pairs"
            format="TRL DPOTrainer"
            description={`{ prompt, chosen, rejected }; chosen beats rejected by ≥ ${DPO_MIN_DELTA} points.`}
            count={stats.dpoPairs}
            href="/api/export/dpo"
            filename="the-soul-problem-dpo.jsonl"
          />
          <DownloadRow
            title="Raw"
            format="Everything"
            description="Every scenario, response, per-criterion judgment with rationales."
            count={stats.rawRows}
            href="/api/export/raw"
            filename="the-soul-problem-raw.jsonl"
          />
        </section>

        <section className="rounded-lg border border-line-subtle bg-surface p-5 mb-10">
          <h3 className="font-semibold text-[0.95rem] mb-2">Licensing</h3>
          <p className="text-muted text-[0.88rem] leading-[1.55]">
            Released for research. Contributors consented to anonymous public release. Please do not
            use the corpus to train systems that manipulate emotionally vulnerable users.
          </p>
        </section>

        <footer className="flex flex-wrap gap-2">
          <Link href="/try" className="btn btn-primary">Add to corpus</Link>
          <Link href="/leaderboard" className="btn btn-secondary">Leaderboard</Link>
        </footer>
      </div>
    </main>
  );
}
