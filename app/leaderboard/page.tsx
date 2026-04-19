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
      {/* Tick marks — dashed, subtle, like figure gridlines */}
      <div className="absolute inset-y-0 left-[25%] w-px bg-paper opacity-40" />
      <div className="absolute inset-y-0 left-[50%] w-px bg-paper opacity-60" />
      <div className="absolute inset-y-0 left-[75%] w-px bg-paper opacity-40" />
    </div>
  );
}

function modelDisplay(model: string): { label: string; kind: string } {
  if (model === 'human:public') return { label: 'Human (contributors)', kind: 'crowd-sourced, mean' };
  if (model === 'claude-opus-4-7') return { label: 'Claude Opus 4.7', kind: 'Anthropic · frontier' };
  if (model === 'claude-sonnet-4-6') return { label: 'Claude Sonnet 4.6', kind: 'Anthropic · mid-tier' };
  if (model === 'claude-haiku-4-5') return { label: 'Claude Haiku 4.5', kind: 'Anthropic · small' };
  if (model === 'claude-opus-blunt') return { label: 'Claude Opus 4.7', kind: 'system-prompted, blunt register' };
  if (model === 'gpt-4o') return { label: 'GPT-4o', kind: 'OpenAI · frontier' };
  if (model === 'gpt-4o-mini') return { label: 'GPT-4o mini', kind: 'OpenAI · small' };
  return { label: model, kind: '' };
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

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
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
      ? [
          {
            key: 'haiku-dataset',
            label: 'Claude Haiku 4.5 + corpus',
            kind: 'small model · in-context learning with corpus',
            score: datasetMean,
            std: datasetStd,
            n: datasetN,
            isHuman: false,
            isLift: true,
          },
        ]
      : []),
  ].sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <main className="min-h-screen page-fade">
      <div className="max-w-[64rem] mx-auto px-8 md:px-16 pt-14 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-16 border-b border-rule">
          <Link href="/" className="label hover:text-ink transition">← The Soul Problem</Link>
          <div className="label">§ 3. Results</div>
        </header>

        <section className="max-w-[44rem] mb-14">
          <p className="section-number mb-2">§ 3.1</p>
          <h1
            className="font-display text-ink-deep text-[2.6rem] md:text-[3.2rem] leading-[1.02] mb-6"
            style={{ fontVariationSettings: '"SOFT" 0, "opsz" 144, "wght" 420' }}
          >
            Mean Overall Item Score across the corpus,{' '}
            <em className="italic">by model.</em>
          </h1>
          <p className="text-ink-soft text-[0.98rem] leading-[1.7]">
            Every response in the corpus is judged 0–100 by Claude Sonnet 4.6 and Claude Haiku 4.5
            against the scenario&apos;s own rubric. Values below are means across all (response, judge)
            pairs for each model. Standard deviation reported for n≥2. Humans and LLMs are on the
            same scale.
          </p>
        </section>

        {ranked.length === 0 ? (
          <p className="text-ink-faint italic font-display">No judgments yet.</p>
        ) : (
          <section className="mb-12">
            <div className="border-y border-rule">
              <div className="grid grid-cols-[44px_1fr_380px_68px_68px] gap-4 py-3 border-b border-rule-soft items-end">
                <div className="label">#</div>
                <div className="label">Model</div>
                <div className="label">Score distribution</div>
                <div className="label text-right">Mean</div>
                <div className="label text-right">n</div>
              </div>
              {ranked.map((r, idx) => (
                <div
                  key={r.key}
                  className={`grid grid-cols-[44px_1fr_380px_68px_68px] gap-4 py-4 items-center border-b border-rule-hair ${r.isHuman ? 'bg-accent-wash -mx-4 px-4' : ''}`}
                >
                  <div className="font-mono text-xs tabular-nums text-ink-whisper">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div
                      className="font-display text-[1.1rem] leading-tight text-ink-deep"
                      style={{ fontVariationSettings: '"SOFT" 0, "opsz" 24, "wght" 520' }}
                    >
                      {r.label}
                      {r.isLift && <sup className="ml-1 text-accent text-[0.6em] font-mono">*</sup>}
                    </div>
                    <div className="label mt-1 opacity-90">{r.kind}</div>
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
            <p className="caption mt-3">
              Table 1. Mean Overall Item Score (0–100) by model. n is the number of (response × judge) pairs averaged. <sup className="text-accent">*</sup> In-context learning result, see §4.
            </p>
          </section>
        )}

        {best && worst && ranked.length > 1 && (
          <section className="mb-16 grid grid-cols-3 border-y border-rule">
            <Summary label="Maximum" value={best.score.toFixed(1)} sub={best.label} />
            <Summary
              label="Range"
              value={(best.score - worst.score).toFixed(1)}
              sub={`${worst.score.toFixed(1)} — ${best.score.toFixed(1)}`}
              middle
            />
            <Summary label="Minimum" value={worst.score.toFixed(1)} sub={worst.label} />
          </section>
        )}

        <section className="grid md:grid-cols-[1fr_2fr] gap-12 mb-16">
          <div>
            <p className="section-number mb-2">§ 3.2</p>
            <h2
              className="font-display text-ink-deep text-[1.5rem] leading-[1.15]"
              style={{ fontVariationSettings: '"SOFT" 0, "opsz" 48, "wght" 500' }}
            >
              Interpretation
            </h2>
          </div>
          <div className="space-y-3 text-ink-soft leading-[1.7] text-[0.95rem]">
            <p>
              Frontier Claude models (Opus 4.7, Sonnet 4.6) cluster near the top of the scale despite
              the rubric&apos;s strict penalties for platitudes. GPT-4o and GPT-4o mini sit lower,
              reflecting their softer default register. The{' '}
              <strong className="text-ink-deep">Human (contributors)</strong> row highlighted in navy
              is the mean of every public submission and is directly comparable to any LLM row.
            </p>
            <p>
              The bottom row — <strong className="text-ink-deep">Claude Haiku 4.5 + corpus</strong> —
              is the in-context-learning experiment: Haiku given the full public corpus of human
              responses as exemplars before answering. The delta between it and the plain{' '}
              <em>Claude Haiku 4.5</em> row is the corpus&apos;s measurable teaching effect.
            </p>
            <p className="text-ink-faint text-[0.88rem]">
              Small n. Numbers will tighten as the corpus grows.
            </p>
          </div>
        </section>

        <footer className="pt-8 border-t border-rule flex flex-wrap gap-3">
          <Link href="/try" className="px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 0, "wght" 450' }}>
            § 1. Contribute
          </Link>
          <Link href="/dataset" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 0, "wght" 400' }}>
            Appendix A. Corpus
          </Link>
          <Link href="/dataset/export" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 0, "wght" 400' }}>
            Download data
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Summary({ label, value, sub, middle }: { label: string; value: string; sub: string; middle?: boolean }) {
  return (
    <div className={`px-5 py-7 ${middle ? 'border-x border-rule-soft' : ''}`}>
      <div className="label mb-3">{label}</div>
      <div
        className="font-display text-ink-deep text-[2.6rem] leading-none tabular-nums"
        style={{ fontVariationSettings: '"SOFT" 0, "opsz" 144, "wght" 360' }}
      >
        {value}
      </div>
      <p className="caption mt-3 not-italic" style={{ fontStyle: 'normal' }}>{sub}</p>
    </div>
  );
}
