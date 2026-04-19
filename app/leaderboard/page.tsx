import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

function Bar({ score, accent }: { score: number; accent?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative flex-1 h-7 bg-paper-sunk border border-rule-hair overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 bar-grow ${accent ? 'bg-accent' : 'bg-ink'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function modelDisplay(model: string): { label: string; kind: string } {
  if (model === 'human:public') return { label: 'Human contributors', kind: 'crowd mean' };
  if (model === 'claude-opus-4-7') return { label: 'Claude Opus 4.7', kind: 'Anthropic · frontier' };
  if (model === 'claude-sonnet-4-6') return { label: 'Claude Sonnet 4.6', kind: 'Anthropic · mid' };
  if (model === 'claude-haiku-4-5') return { label: 'Claude Haiku 4.5', kind: 'Anthropic · small' };
  if (model === 'claude-opus-blunt') return { label: 'Claude Opus 4.7', kind: 'blunt system prompt' };
  if (model === 'gpt-4o') return { label: 'GPT-4o', kind: 'OpenAI · frontier' };
  if (model === 'gpt-4o-mini') return { label: 'GPT-4o mini', kind: 'OpenAI · small' };
  return { label: model, kind: '' };
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
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

  const { data: liftSnaps } = await db
    .from('dataset_lift_snapshots')
    .select('dataset_score');
  const datasetScores = (liftSnaps ?? []).map(s => s.dataset_score);
  const datasetMean = datasetScores.length
    ? datasetScores.reduce((a, b) => a + b, 0) / datasetScores.length
    : null;
  const datasetStd = datasetScores.length ? stddev(datasetScores) : 0;

  return { byModel, datasetMean, datasetStd, datasetN: datasetScores.length };
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
          key: 'haiku-dataset',
          label: 'Claude Haiku 4.5 + corpus',
          kind: 'in-context learning with corpus',
          score: datasetMean,
          std: datasetStd,
          n: datasetN,
          isHuman: false,
          isLift: true,
        }]
      : []),
  ].sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <main className="min-h-screen page-fade">
      <div className="max-w-[64rem] mx-auto px-8 md:px-14 pt-12 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-14 hairline">
          <Link href="/" className="font-display text-ink-deep text-[1.05rem]" style={{ fontVariationSettings: '"SOFT" 30, "wght" 600' }}>
            ← The Soul Problem
          </Link>
          <div className="text-[0.92rem] text-ink-soft">Leaderboard</div>
        </header>

        <section className="max-w-[44rem] mb-12">
          <h1
            className="font-display text-ink-deep text-[2.6rem] md:text-[3.2rem] leading-[1.02] mb-5"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 400' }}
          >
            Who writes grief well,{' '}
            <em className="italic">and who only thinks they do.</em>
          </h1>
          <p className="text-ink-soft text-[1.05rem] leading-[1.65]">
            Every response in the corpus, judged 0–100 against its scenario&apos;s own rubric by
            Claude Sonnet 4.6 and Haiku 4.5. Humans and LLMs on the same scale.
          </p>
        </section>

        {ranked.length === 0 ? (
          <p className="text-ink-faint italic font-display">No judgments yet.</p>
        ) : (
          <section className="mb-16">
            <div className="border-y border-rule">
              <div className="grid grid-cols-[40px_1fr_320px_72px_52px] gap-4 py-3 border-b border-rule-soft items-end">
                <div className="tag">Rank</div>
                <div className="tag">Model</div>
                <div className="tag">Score</div>
                <div className="tag text-right">Mean</div>
                <div className="tag text-right">n</div>
              </div>
              {ranked.map((r, idx) => (
                <div
                  key={r.key}
                  className={`grid grid-cols-[40px_1fr_320px_72px_52px] gap-4 py-4 items-center border-b border-rule-hair ${r.isHuman ? 'bg-accent-wash -mx-3 px-3' : ''}`}
                >
                  <div className="font-mono text-sm tabular-nums text-ink-faint">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div
                      className="font-display text-[1.1rem] leading-tight text-ink-deep"
                      style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 550' }}
                    >
                      {r.label}
                    </div>
                    <div className="text-[0.82rem] text-ink-faint mt-0.5">{r.kind}</div>
                  </div>
                  <Bar score={r.score} accent={r.isHuman || r.isLift} />
                  <div className="font-mono text-sm tabular-nums text-ink-deep text-right" style={{ fontWeight: 500 }}>
                    {r.score.toFixed(1)}
                    {r.std > 0 && (
                      <span className="text-ink-whisper text-xs block">± {r.std.toFixed(1)}</span>
                    )}
                  </div>
                  <div className="font-mono text-sm tabular-nums text-ink-faint text-right">
                    {r.n}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {best && worst && ranked.length > 1 && (
          <section className="mb-16 grid grid-cols-3 border-y border-rule">
            <Summary label="Top" value={best.score.toFixed(1)} sub={best.label} />
            <Summary
              label="Range"
              value={(best.score - worst.score).toFixed(1)}
              sub={`${worst.score.toFixed(1)} — ${best.score.toFixed(1)}`}
              middle
            />
            <Summary label="Bottom" value={worst.score.toFixed(1)} sub={worst.label} />
          </section>
        )}

        <footer className="pt-8 border-t border-rule flex flex-wrap gap-3">
          <Link href="/try" className="px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 500' }}>
            Write a response
          </Link>
          <Link href="/dataset" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 450' }}>
            Browse corpus
          </Link>
          <Link href="/dataset/export" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 450' }}>
            Download
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Summary({ label, value, sub, middle }: { label: string; value: string; sub: string; middle?: boolean }) {
  return (
    <div className={`px-5 py-7 ${middle ? 'border-x border-rule-soft' : ''}`}>
      <div className="tag mb-3">{label}</div>
      <div
        className="font-display text-ink-deep text-[2.5rem] leading-none tabular-nums"
        style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 380' }}
      >
        {value}
      </div>
      <p className="text-[0.85rem] text-ink-faint mt-3">{sub}</p>
    </div>
  );
}
