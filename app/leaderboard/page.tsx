import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

function scoreColorBar(n: number): string {
  if (n >= 85) return 'bg-emerald-500';
  if (n >= 75) return 'bg-emerald-400';
  if (n >= 65) return 'bg-amber-400';
  if (n >= 50) return 'bg-orange-400';
  return 'bg-rose-400';
}

function Row({
  label,
  sublabel,
  score,
  n,
  highlight,
}: {
  label: string;
  sublabel?: string;
  score: number;
  n: number;
  highlight?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className={`grid grid-cols-[260px_60px_1fr] gap-3 items-center py-2 ${highlight ? 'bg-neutral-50 rounded-md px-3' : 'px-3'}`}>
      <div>
        <div className={`text-sm ${highlight ? 'font-semibold text-neutral-900' : 'text-neutral-800'}`}>
          {label}
        </div>
        {sublabel && <div className="text-xs text-neutral-500 mt-0.5">{sublabel}</div>}
      </div>
      <div className="text-xs text-neutral-500 tabular-nums">
        n={n}
      </div>
      <div className="relative h-8 bg-neutral-100 rounded-md overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${scoreColorBar(score)} transition-all`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-end pr-3 text-sm font-medium tabular-nums text-neutral-900">
          {score.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

function modelDisplay(model: string): string {
  if (model === 'human:public') return 'Human (contributors)';
  if (model === 'claude-opus-4-7') return 'Claude Opus 4.7';
  if (model === 'claude-sonnet-4-6') return 'Claude Sonnet 4.6';
  if (model === 'claude-haiku-4-5') return 'Claude Haiku 4.5';
  if (model === 'claude-opus-blunt') return 'Claude Opus 4.7 (blunt)';
  return model;
}

async function loadLeaderboard() {
  const db = supabaseService();

  const { data: rows } = await db
    .from('judgments')
    .select(`
      overall_score,
      responses!inner(model)
    `);

  // Aggregate by model (one row per response × judge — averaging across both also averages
  // across judges per response).
  const buckets = new Map<string, number[]>();
  for (const r of ((rows ?? []) as any[])) {
    const model = r.responses.model;
    if (model.startsWith('human:private')) continue;
    const arr = buckets.get(model) ?? [];
    arr.push(r.overall_score);
    buckets.set(model, arr);
  }
  const byModel = [...buckets.entries()].map(([model, scores]) => ({
    model,
    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    n: scores.length,
  }));

  // Haiku + dataset row comes from dataset_lift_snapshots
  const { data: liftSnaps } = await db
    .from('dataset_lift_snapshots')
    .select('dataset_score');
  const datasetScores = (liftSnaps ?? []).map(s => s.dataset_score);
  const datasetMean = datasetScores.length
    ? datasetScores.reduce((a, b) => a + b, 0) / datasetScores.length
    : null;

  return { byModel, datasetMean, datasetN: datasetScores.length };
}

export default async function LeaderboardPage() {
  const { byModel, datasetMean, datasetN } = await loadLeaderboard();

  const ranked = [
    ...byModel.map(b => ({
      key: b.model,
      label: modelDisplay(b.model),
      sublabel:
        b.model === 'human:public'
          ? 'mean across every public contribution'
          : 'mean across every seeded response, both judges',
      score: b.mean,
      n: b.n,
      highlight: b.model === 'human:public',
    })),
    ...(datasetMean !== null
      ? [
          {
            key: 'haiku-dataset',
            label: 'Claude Haiku 4.5 + dataset',
            sublabel: 'in-context learning with contributed human responses',
            score: datasetMean,
            n: datasetN,
            highlight: true,
          },
        ]
      : []),
  ].sort((a, b) => b.score - a.score);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-700">
            ← home
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            Leaderboard
          </h1>
          <p className="text-neutral-600 max-w-2xl">
            Mean Overall Item Score across every scenario in the dataset. Higher is better.
            Judged 0–100 by Claude Sonnet 4.6 and Claude Haiku 4.5 against each scenario's
            own rubric. Humans and LLMs on the same scale.
          </p>
        </header>

        {ranked.length === 0 ? (
          <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700">
            No judgments yet. Submit a response or seed the data to populate the leaderboard.
          </section>
        ) : (
          <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-3 py-3 border-b border-neutral-200 grid grid-cols-[260px_60px_1fr] gap-3 text-xs uppercase tracking-wider text-neutral-500">
              <div>Model</div>
              <div>n</div>
              <div>Score</div>
            </div>
            <div className="divide-y divide-neutral-100">
              {ranked.map(r => (
                <Row
                  key={r.key}
                  label={r.label}
                  sublabel={r.sublabel}
                  score={r.score}
                  n={r.n}
                  highlight={r.highlight}
                />
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 space-y-2">
          <p><strong className="text-neutral-900">How to read this.</strong></p>
          <p>
            Each row is a model's mean Overall Item Score across every judgment in the dataset.
            The <strong>Human (contributors)</strong> row is every public human submission averaged together.
            The <strong>Claude Haiku + dataset</strong> row is Haiku's score when given contributed human
            responses as in-context examples — the dataset's measurable effect on a weaker model.
          </p>
          <p className="text-xs text-neutral-500 pt-1">
            <code className="bg-white border border-neutral-200 rounded px-1 py-0.5">n</code> is the number of
            (response × judge) pairs or (lift snapshot) rows averaged. Low n means noisy numbers.
          </p>
        </section>

        <div className="flex gap-3">
          <Link href="/try" className="px-5 py-2 rounded-lg bg-neutral-900 text-white text-sm">
            Write a response
          </Link>
          <Link href="/dataset" className="px-5 py-2 rounded-lg border border-neutral-300 text-sm">
            Browse the dataset
          </Link>
          <Link href="/dataset/export" className="px-5 py-2 rounded-lg border border-neutral-300 text-sm">
            Download the data
          </Link>
        </div>
      </div>
    </main>
  );
}
