import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

function Bar({ score, n, you }: { score: number; n: number; you?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 h-10 bg-paper-warm rounded-none border border-rule-soft overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 bar-grow ${you ? 'bg-accent' : 'bg-ink'}`}
          style={{ width: `${pct}%` }}
        />
        {/* Subtle tick marks at 25/50/75 */}
        <div className="absolute inset-y-0 left-[25%] w-px bg-paper opacity-25" />
        <div className="absolute inset-y-0 left-[50%] w-px bg-paper opacity-40" />
        <div className="absolute inset-y-0 left-[75%] w-px bg-paper opacity-25" />
      </div>
      <div className="font-mono text-[0.95rem] tabular-nums text-ink-deep w-14 text-right" style={{ fontWeight: 500 }}>
        {score.toFixed(1)}
      </div>
      <div className="font-mono text-[0.7rem] tabular-nums text-ink-whisper w-10 text-right">
        n={n}
      </div>
    </div>
  );
}

function modelDisplay(model: string): { label: string; kind: string } {
  if (model === 'human:public') return { label: 'Human contributors', kind: 'the humans' };
  if (model === 'claude-opus-4-7') return { label: 'Claude Opus 4.7', kind: 'Anthropic · frontier' };
  if (model === 'claude-sonnet-4-6') return { label: 'Claude Sonnet 4.6', kind: 'Anthropic · mid' };
  if (model === 'claude-haiku-4-5') return { label: 'Claude Haiku 4.5', kind: 'Anthropic · small' };
  if (model === 'claude-opus-blunt') return { label: 'Claude Opus 4.7', kind: 'system-prompted · blunt' };
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
    n: scores.length,
  }));

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
      ...modelDisplay(b.model),
      score: b.mean,
      n: b.n,
      isHuman: b.model === 'human:public',
    })),
    ...(datasetMean !== null
      ? [
          {
            key: 'haiku-dataset',
            label: 'Claude Haiku 4.5 + dataset',
            kind: 'small model · in-context learning',
            score: datasetMean,
            n: datasetN,
            isHuman: false,
          },
        ]
      : []),
  ].sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <main className="min-h-screen">
      <div className="max-w-[68rem] mx-auto px-8 md:px-16 pt-16 pb-24">
        <header className="flex items-baseline justify-between pb-6 mb-16 hairline reveal-in">
          <Link href="/" className="eyebrow hover:text-ink transition">← The Soul Problem</Link>
          <div className="eyebrow">Standings · vol. I</div>
        </header>

        <section className="mb-16 reveal-up">
          <p className="eyebrow mb-4">Standings</p>
          <h1
            className="font-display text-ink-deep text-[3.5rem] md:text-[5rem] leading-[0.95] font-light"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 320' }}
          >
            Who writes grief well,<br />
            <em className="italic text-accent-deep" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 360' }}>
              and who only thinks they do.
            </em>
          </h1>
          <p className="text-[1.05rem] leading-[1.7] text-ink-soft mt-6 max-w-[44rem]">
            Every model in the corpus, judged on the same rubric, on the same scenarios. Humans and
            LLMs on the same scale. The score is 0–100, averaged across all scenarios and both
            judges (Claude Sonnet 4.6 and Claude Haiku 4.5).
          </p>
        </section>

        {ranked.length === 0 ? (
          <section className="py-16 text-center">
            <p className="text-ink-faint italic font-display">No judgments yet.</p>
          </section>
        ) : (
          <section className="space-y-0 mb-20 reveal-up" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-[32px_1fr_420px] gap-6 pb-4 border-b border-rule items-end">
              <div className="eyebrow">Rk</div>
              <div className="eyebrow">Model</div>
              <div className="eyebrow">Score · n</div>
            </div>
            {ranked.map((r, idx) => (
              <div
                key={r.key}
                className={`grid grid-cols-[32px_1fr_420px] gap-6 items-center py-5 border-b border-rule-soft reveal-up ${
                  r.isHuman ? 'bg-accent-wash -mx-4 px-4' : ''
                }`}
                style={{ animationDelay: `${0.3 + idx * 0.06}s` }}
              >
                <div className="font-mono text-sm tabular-nums text-ink-whisper">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div>
                  <div
                    className="font-display text-[1.35rem] leading-tight text-ink-deep"
                    style={{ fontVariationSettings: '"SOFT" 70, "opsz" 48, "wght" 480' }}
                  >
                    {r.label}
                  </div>
                  <div className="eyebrow mt-1 opacity-80">{r.kind}</div>
                </div>
                <Bar score={r.score} n={r.n} you={r.isHuman} />
              </div>
            ))}
          </section>
        )}

        {best && worst && ranked.length > 1 && (
          <section className="grid md:grid-cols-3 gap-0 border-y border-rule mb-20 reveal-up" style={{ animationDelay: '0.8s' }}>
            <FactBox
              label="Leader"
              value={best.score.toFixed(1)}
              caption={best.label}
            />
            <FactBox
              label="Range"
              value={(best.score - worst.score).toFixed(1)}
              caption={`from ${worst.score.toFixed(1)} to ${best.score.toFixed(1)}`}
              middle
            />
            <FactBox
              label="Cellar"
              value={worst.score.toFixed(1)}
              caption={worst.label}
            />
          </section>
        )}

        <section className="grid md:grid-cols-12 gap-10 mb-16">
          <div className="md:col-span-4">
            <p className="eyebrow mb-3">How to read this</p>
          </div>
          <div className="md:col-span-8 space-y-3 text-ink-soft leading-[1.7]">
            <p>
              Each bar shows a model&apos;s mean Overall Item Score across every judgment
              it received. <strong className="text-ink-deep">Human contributors</strong>{' '}
              (highlighted in oxblood) is every public submission averaged together.
              <strong className="text-ink-deep"> Claude Haiku 4.5 + dataset</strong> is the
              in-context-learning experiment — Haiku given contributed human responses as
              examples before answering.
            </p>
            <p className="text-ink-faint text-sm">
              <code className="font-mono text-xs">n</code> is the number of
              (response × judge) or (snapshot) rows averaged. Small n means noisy numbers.
            </p>
          </div>
        </section>

        <footer className="pt-8 flex flex-wrap gap-3 border-t border-rule">
          <Link href="/try" className="px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display text-base" style={{ fontVariationSettings: '"SOFT" 60, "wght" 450' }}>
            Write a response
          </Link>
          <Link href="/dataset" className="px-6 py-3 border border-rule hover:border-ink text-ink transition font-display text-base" style={{ fontVariationSettings: '"SOFT" 80, "wght" 400' }}>
            Browse the archive
          </Link>
          <Link href="/dataset/export" className="px-6 py-3 border border-rule hover:border-ink text-ink transition font-display text-base" style={{ fontVariationSettings: '"SOFT" 80, "wght" 400' }}>
            Download the dataset
          </Link>
        </footer>
      </div>
    </main>
  );
}

function FactBox({ label, value, caption, middle }: { label: string; value: string; caption: string; middle?: boolean }) {
  return (
    <div className={`px-6 py-8 ${middle ? 'border-x border-rule' : ''}`}>
      <div className="eyebrow mb-4">{label}</div>
      <div
        className="font-display text-ink-deep text-[3rem] leading-none tabular-nums"
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 300' }}
      >
        {value}
      </div>
      <p className="text-ink-faint text-sm mt-4">{caption}</p>
    </div>
  );
}
