import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

const SFT_SCORE_THRESHOLD = 75;
const DPO_MIN_DELTA = 5;

async function loadStats() {
  const db = supabaseService();

  const [{ data: publicResponses }, { data: allResponses }, { count: scenarios }] = await Promise.all([
    db
      .from('responses')
      .select('id, judgments(overall_score)')
      .eq('model', 'human:public'),
    db
      .from('responses')
      .select('id, scenario_id, judgments(overall_score)'),
    db.from('scenarios').select('*', { count: 'exact', head: true }),
  ]);

  const sftEligible = ((publicResponses ?? []) as any[]).filter(r => {
    const js = r.judgments ?? [];
    if (!js.length) return false;
    return Math.max(...js.map((j: any) => j.overall_score)) >= SFT_SCORE_THRESHOLD;
  }).length;

  // DPO pair count: for each scenario, count pairs (i, j) where mean[i] - mean[j] >= DPO_MIN_DELTA
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

  return {
    scenarios: scenarios ?? 0,
    sftEligible,
    dpoPairs,
    rawRows,
  };
}

function DownloadCard({
  title,
  description,
  format,
  count,
  href,
  filename,
}: {
  title: string;
  description: string;
  format: string;
  count: number;
  href: string;
  filename: string;
}) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-6 flex flex-col space-y-3">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="text-xs uppercase tracking-wider text-neutral-500">{format}</p>
      </div>
      <p className="text-sm text-neutral-700 leading-relaxed flex-1">{description}</p>
      <div className="text-sm text-neutral-600">
        <strong className="text-neutral-900 tabular-nums">{count}</strong> example{count === 1 ? '' : 's'} right now
      </div>
      {count > 0 ? (
        <a
          href={href}
          download={filename}
          className="inline-block text-center px-4 py-2 rounded-lg font-medium text-sm bg-neutral-900 text-white hover:bg-neutral-800 transition"
        >
          Download .jsonl
        </a>
      ) : (
        <span className="inline-block text-center px-4 py-2 rounded-lg font-medium text-sm bg-neutral-100 text-neutral-400 cursor-not-allowed">
          Not enough data yet
        </span>
      )}
    </article>
  );
}

export default async function ExportPage() {
  const stats = await loadStats();

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/dataset" className="text-sm text-neutral-500 hover:text-neutral-700">
            ← dataset
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            Download the dataset
          </h1>
          <p className="text-neutral-600 max-w-2xl">
            Three formats, ready to drop into your training pipeline. Every file is fresh — generated
            from live DB state on click.
          </p>
        </header>

        <section className="grid md:grid-cols-3 gap-4">
          <DownloadCard
            title="SFT"
            format="supervised fine-tuning"
            description={`Chat-format JSONL. Each line is { messages: [{role:"user",...}, {role:"assistant",...}] } using public human responses that scored ≥ ${SFT_SCORE_THRESHOLD}/100. Compatible with OpenAI, Anthropic, HuggingFace SFTTrainer, TRL.`}
            count={stats.sftEligible}
            href="/api/export/sft"
            filename="the-soul-problem-sft.jsonl"
          />
          <DownloadCard
            title="DPO"
            format="direct preference optimization"
            description={`Paired preferences. Each line is { prompt, chosen, rejected } where chosen beats rejected by ≥ ${DPO_MIN_DELTA} points on this scenario. Humans-beat-LLMs pairs are the interesting signal.`}
            count={stats.dpoPairs}
            href="/api/export/dpo"
            filename="the-soul-problem-dpo.jsonl"
          />
          <DownloadCard
            title="Raw"
            format="everything"
            description="Full export: every scenario, every response (human + LLM), every per-criterion judgment with rationales. Bring your own loss function."
            count={stats.rawRows}
            href="/api/export/raw"
            filename="the-soul-problem-raw.jsonl"
          />
        </section>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 space-y-2">
          <p><strong className="text-neutral-900">What to do with these files.</strong></p>
          <p>
            The SFT file drops into <code className="text-xs bg-white border border-neutral-200 rounded px-1 py-0.5">
              openai.fine_tuning.jobs.create(training_file=...)
            </code>,{' '}
            <code className="text-xs bg-white border border-neutral-200 rounded px-1 py-0.5">
              anthropic.fine_tuning...
            </code>, or a local QLoRA trainer. The DPO file drops into{' '}
            <code className="text-xs bg-white border border-neutral-200 rounded px-1 py-0.5">
              trl.DPOTrainer
            </code>. The raw file is for researchers who want to compute their own metrics or build a different aggregation.
          </p>
        </section>

        <footer className="pt-4 border-t border-neutral-200 text-xs text-neutral-400">
          Dataset grows every time someone writes a response and opts in. Come back later — the export reflects live state.
        </footer>
      </div>
    </main>
  );
}
