import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

function Bar({ score, accent }: { score: number; accent?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative flex-1 h-6 bg-surface-3 rounded overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 bar-grow rounded ${accent ? 'bg-accent' : 'bg-text'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function modelDisplay(model: string): { label: string; kind: string } {
  if (model === 'human:public') return { label: 'Human contributors', kind: 'crowd mean' };
  if (model === 'claude-opus-4-7') return { label: 'Claude Opus 4.7', kind: 'Anthropic' };
  if (model === 'claude-sonnet-4-6') return { label: 'Claude Sonnet 4.6', kind: 'Anthropic' };
  if (model === 'claude-haiku-4-5') return { label: 'Claude Haiku 4.5', kind: 'Anthropic' };
  if (model === 'claude-opus-blunt') return { label: 'Claude Opus (blunt)', kind: 'system-prompted' };
  if (model === 'gpt-4o') return { label: 'GPT-4o', kind: 'OpenAI' };
  if (model === 'gpt-4o-mini') return { label: 'GPT-4o mini', kind: 'OpenAI' };
  return { label: model, kind: '' };
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

async function loadLeaderboard() {
  const db = supabaseService();
  const { data: rows } = await db
    .from('judgments')
    .select(`overall_score, responses!inner(model)`);
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
    std: stddev(scores),
    n: scores.length,
  }));
  const { data: liftSnaps } = await db.from('dataset_lift_snapshots').select('dataset_score');
  const dScores = (liftSnaps ?? []).map(s => s.dataset_score);
  const datasetMean = dScores.length ? dScores.reduce((a, b) => a + b, 0) / dScores.length : null;
  return { byModel, datasetMean, datasetStd: dScores.length ? stddev(dScores) : 0, datasetN: dScores.length };
}

export default async function LeaderboardPage() {
  const { byModel, datasetMean, datasetStd, datasetN } = await loadLeaderboard();

  const ranked = [
    ...byModel.map(b => ({
      key: b.model,
      ...modelDisplay(b.model),
      score: b.mean,
      std: b.std,
      n: b.n,
      isHuman: b.model === 'human:public',
      isLift: false,
    })),
    ...(datasetMean !== null
      ? [{
          key: 'haiku-corpus',
          label: 'Claude Haiku 4.5 + corpus',
          kind: 'in-context with dataset',
          score: datasetMean,
          std: datasetStd,
          n: datasetN,
          isHuman: false,
          isLift: true,
        }]
      : []),
  ].sort((a, b) => b.score - a.score);

  return (
    <main className="min-h-screen fade-in">
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-12 border-b border-line">
          <Link href="/" className="font-semibold tracking-tight text-[0.95rem]">
            ← The Soul Problem
          </Link>
          <div className="text-[0.85rem] text-muted">Leaderboard</div>
        </header>

        <section className="mb-10 max-w-2xl">
          <h1 className="text-[2.2rem] font-semibold tracking-tight leading-[1.1] mb-4">
            How every model scores on grief writing.
          </h1>
          <p className="text-muted leading-[1.55]">
            Every response in the corpus, judged 0–100 against its scenario&apos;s rubric by Claude
            Sonnet 4.6 and Haiku 4.5. Humans and LLMs on the same scale.
          </p>
        </section>

        {ranked.length === 0 ? (
          <p className="text-faint italic">No judgments yet.</p>
        ) : (
          <section className="rounded-lg border border-line overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_280px_80px_60px] gap-4 px-4 py-3 border-b border-line bg-surface text-[0.78rem] text-faint">
              <div>#</div>
              <div>Model</div>
              <div>Score</div>
              <div className="text-right">Mean</div>
              <div className="text-right">n</div>
            </div>
            {ranked.map((r, idx) => (
              <div
                key={r.key}
                className={`grid grid-cols-[40px_1fr_280px_80px_60px] gap-4 px-4 py-3.5 items-center border-b border-line-subtle last:border-0 ${r.isHuman ? 'bg-accent-tint' : ''}`}
              >
                <div className="font-mono text-xs text-faint tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div>
                  <div className="font-medium text-[0.95rem]">{r.label}</div>
                  <div className="text-[0.78rem] text-faint">{r.kind}</div>
                </div>
                <Bar score={r.score} accent={r.isHuman || r.isLift} />
                <div className="font-mono text-sm tabular-nums text-right" style={{ fontWeight: 500 }}>
                  {r.score.toFixed(1)}
                  {r.std > 0 && (
                    <span className="text-faint text-xs block font-normal">± {r.std.toFixed(1)}</span>
                  )}
                </div>
                <div className="font-mono text-xs tabular-nums text-faint text-right">{r.n}</div>
              </div>
            ))}
          </section>
        )}

        <footer className="pt-8 border-t border-line-subtle mt-10 flex flex-wrap gap-2">
          <Link href="/try" className="btn btn-primary">Write a response</Link>
          <Link href="/dataset" className="btn btn-secondary">Browse dataset</Link>
          <Link href="/dataset/export" className="btn btn-secondary">Download</Link>
        </footer>
      </div>
    </main>
  );
}
