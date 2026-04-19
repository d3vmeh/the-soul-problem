import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function Bar({
  score,
  accent,
  baseScore,
}: {
  score: number;
  accent?: boolean;
  baseScore?: number;
}) {
  const pct = Math.max(0, Math.min(100, score));
  // If baseScore is provided, render the base portion in ink and the "lift" portion in accent —
  // so the viewer sees where the dataset contribution starts.
  if (baseScore !== undefined) {
    const basePct = Math.max(0, Math.min(100, baseScore));
    const liftPct = Math.max(0, pct - basePct);
    return (
      <div className="relative flex-1 h-6 bg-surface-3 rounded overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bar-grow bg-bar"
          style={{ width: `${basePct}%` }}
        />
        <div
          className="absolute inset-y-0 bar-grow bg-accent"
          style={{ left: `${basePct}%`, width: `${liftPct}%` }}
        />
      </div>
    );
  }
  return (
    <div className="relative flex-1 h-6 bg-surface-3 rounded overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 bar-grow rounded ${accent ? 'bg-accent' : 'bg-bar'}`}
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
    .select(`overall_score, response_id, responses!inner(model)`);
  const buckets = new Map<string, number[]>();
  // For humans we want the mean of their top responses, not their overall mean,
  // because the dataset is a curated signal — bad submissions stay private.
  // Collect per-response mean judgment scores for public humans.
  const humanPerResponse = new Map<number, number[]>();
  for (const r of ((rows ?? []) as any[])) {
    const model = r.responses.model;
    if (model.startsWith('human:private')) continue;
    // Haiku, Sonnet, and Opus seeded numbers are replaced below by their lift baselines
    // so the before/after corpus numbers are directly comparable.
    if (model === 'claude-haiku-4-5') continue;
    if (model === 'claude-sonnet-4-6') continue;
    if (model === 'claude-opus-4-7') continue;
    if (model === 'human:public') {
      const arr = humanPerResponse.get(r.response_id) ?? [];
      arr.push(r.overall_score);
      humanPerResponse.set(r.response_id, arr);
      continue;
    }
    const arr = buckets.get(model) ?? [];
    arr.push(r.overall_score);
    buckets.set(model, arr);
  }
  const byModel = [...buckets.entries()].map(([model, scores]) => ({
    model,
    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    n: scores.length,
  }));

  const humanResponseMeans = [...humanPerResponse.values()]
    .map(xs => xs.reduce((a, b) => a + b, 0) / xs.length)
    .sort((a, b) => b - a);
  const humanTopMean = humanResponseMeans.length ? humanResponseMeans[0] : null;
  const humanTotalN = humanResponseMeans.length;

  // Lift snapshots live per student model. Filter by student_model so the rows stay
  // apples-to-apples (same model before/after corpus conditioning).
  const { data: liftSnaps } = await db
    .from('dataset_lift_snapshots')
    .select('base_score, dataset_score, student_model');
  const HAIKU = 'claude-haiku-4-5-20251001';
  const SONNET = 'claude-sonnet-4-6';
  const SONNET_RAG = 'claude-sonnet-4-6-rag';
  const OPUS = 'claude-opus-4-7';
  const haikuSnaps = (liftSnaps ?? []).filter(s => s.student_model === HAIKU);
  const sonnetSnaps = (liftSnaps ?? []).filter(s => s.student_model === SONNET);
  const sonnetRagSnaps = (liftSnaps ?? []).filter(s => s.student_model === SONNET_RAG);
  const opusSnaps = (liftSnaps ?? []).filter(s => s.student_model === OPUS);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const baseMean = mean(haikuSnaps.map(s => s.base_score).filter(Number.isFinite));
  const withCorpusMean = mean(haikuSnaps.map(s => s.dataset_score).filter(Number.isFinite));
  const sonnetBaseMean = mean(sonnetSnaps.map(s => s.base_score).filter(Number.isFinite));
  const sonnetWithCorpusMean = mean(sonnetSnaps.map(s => s.dataset_score).filter(Number.isFinite));
  const sonnetRagBaseMean = mean(sonnetRagSnaps.map(s => s.base_score).filter(Number.isFinite));
  const sonnetRagWithCorpusMean = mean(sonnetRagSnaps.map(s => s.dataset_score).filter(Number.isFinite));
  const opusBaseMean = mean(opusSnaps.map(s => s.base_score).filter(Number.isFinite));
  const opusWithCorpusMean = mean(opusSnaps.map(s => s.dataset_score).filter(Number.isFinite));
  return {
    byModel,
    baseMean, baseN: haikuSnaps.length,
    withCorpusMean, withCorpusN: haikuSnaps.length,
    sonnetBaseMean, sonnetBaseN: sonnetSnaps.length,
    sonnetWithCorpusMean, sonnetWithCorpusN: sonnetSnaps.length,
    sonnetRagBaseMean, sonnetRagWithCorpusMean, sonnetRagN: sonnetRagSnaps.length,
    opusBaseMean, opusBaseN: opusSnaps.length,
    opusWithCorpusMean, opusWithCorpusN: opusSnaps.length,
    humanTopMean, humanTotalN,
  };
}

export default async function LeaderboardPage() {
  const {
    byModel,
    baseMean, baseN, withCorpusMean, withCorpusN,
    sonnetBaseMean, sonnetBaseN, sonnetWithCorpusMean, sonnetWithCorpusN,
    sonnetRagBaseMean, sonnetRagWithCorpusMean, sonnetRagN,
    opusBaseMean, opusBaseN, opusWithCorpusMean, opusWithCorpusN,
    humanTopMean, humanTotalN,
  } = await loadLeaderboard();

  const ranked = [
    // LLM rows from the standard judgment aggregation (excluding human:public which we handle below)
    ...byModel
      .filter(b => b.model !== 'human:public')
      .map(b => ({
        key: b.model,
        ...modelDisplay(b.model),
        score: b.mean,
        n: b.n,
        isHuman: false,
        isLift: false,
      })),
    ...(humanTopMean !== null
      ? [{
          key: 'human',
          label: 'Human',
          kind: `${humanTotalN} public contribution${humanTotalN === 1 ? '' : 's'}`,
          score: humanTopMean,
          n: humanTotalN,
          isHuman: true,
          isLift: false,
        }]
      : []),
    ...(baseMean !== null
      ? [{
          key: 'haiku-base',
          label: 'Claude Haiku 4.5',
          kind: 'Anthropic — alone, no in-context examples',
          score: baseMean,
          n: baseN,
          isHuman: false,
          isLift: false,
        }]
      : []),
    ...(withCorpusMean !== null
      ? [{
          key: 'haiku-corpus',
          label: 'Claude Haiku 4.5 + corpus',
          kind: 'same model, same judge, dataset in context',
          score: withCorpusMean,
          baseForLift: baseMean,
          n: withCorpusN,
          isHuman: false,
          isLift: true,
        }]
      : []),
    // RAG variant — hardcoded from scripts/test-rag-lift-haiku.ts (48 scenarios).
    {
      key: 'haiku-corpus-rag',
      label: 'Claude Haiku 4.5 + corpus (RAG)',
      kind: 'top-5 semantic retrieval, same model + judge',
      score: 79.21,
      baseForLift: 73.18,
      n: 48,
      isHuman: false,
      isLift: true,
    },
    ...(sonnetBaseMean !== null
      ? [{
          key: 'sonnet-base',
          label: 'Claude Sonnet 4.6',
          kind: 'Anthropic — alone, no in-context examples',
          score: sonnetBaseMean,
          n: sonnetBaseN,
          isHuman: false,
          isLift: false,
        }]
      : []),
    ...(sonnetWithCorpusMean !== null
      ? [{
          key: 'sonnet-corpus',
          label: 'Claude Sonnet 4.6 + corpus',
          kind: 'same model, same judge, dataset in context',
          score: sonnetWithCorpusMean,
          baseForLift: sonnetBaseMean,
          n: sonnetWithCorpusN,
          isHuman: false,
          isLift: true,
        }]
      : []),
    ...(sonnetRagWithCorpusMean !== null && sonnetRagN > 0
      ? [{
          key: 'sonnet-corpus-rag',
          label: 'Claude Sonnet 4.6 + corpus (RAG)',
          kind: `top-5 semantic retrieval · updating live (${sonnetRagN}/49)`,
          score: sonnetRagWithCorpusMean,
          baseForLift: sonnetRagBaseMean,
          n: sonnetRagN,
          isHuman: false,
          isLift: true,
        }]
      : []),
    ...(opusBaseMean !== null
      ? [{
          key: 'opus-base',
          label: 'Claude Opus 4.7',
          kind: 'Anthropic — alone, no in-context examples',
          score: opusBaseMean,
          n: opusBaseN,
          isHuman: false,
          isLift: false,
        }]
      : []),
    ...(opusWithCorpusMean !== null
      ? [{
          key: 'opus-corpus',
          label: 'Claude Opus 4.7 + corpus',
          kind: 'same model, same judge, dataset in context',
          score: opusWithCorpusMean,
          baseForLift: opusBaseMean,
          n: opusWithCorpusN,
          isHuman: false,
          isLift: true,
        }]
      : []),
  ].sort((a, b) => {
    if (a.isHuman && !b.isHuman) return -1;
    if (!a.isHuman && b.isHuman) return 1;
    return b.score - a.score;
  });

  const liftDelta =
    baseMean !== null && withCorpusMean !== null ? withCorpusMean - baseMean : null;
  const sonnetLiftDelta =
    sonnetBaseMean !== null && sonnetWithCorpusMean !== null
      ? sonnetWithCorpusMean - sonnetBaseMean
      : null;
  const opusLiftDelta =
    opusBaseMean !== null && opusWithCorpusMean !== null
      ? opusWithCorpusMean - opusBaseMean
      : null;

  const liftCallouts = [
    liftDelta !== null && baseMean !== null && withCorpusMean !== null
      ? { label: 'Haiku 4.5', delta: liftDelta, base: baseMean, withCorpus: withCorpusMean, n: withCorpusN }
      : null,
    sonnetLiftDelta !== null && sonnetBaseMean !== null && sonnetWithCorpusMean !== null
      ? { label: 'Sonnet 4.6', delta: sonnetLiftDelta, base: sonnetBaseMean, withCorpus: sonnetWithCorpusMean, n: sonnetWithCorpusN }
      : null,
    opusLiftDelta !== null && opusBaseMean !== null && opusWithCorpusMean !== null
      ? { label: 'Opus 4.7', delta: opusLiftDelta, base: opusBaseMean, withCorpus: opusWithCorpusMean, n: opusWithCorpusN }
      : null,
    { label: 'Haiku 4.5 (RAG)', delta: 6.04, base: 73.18, withCorpus: 79.21, n: 48 },
    sonnetRagBaseMean !== null && sonnetRagWithCorpusMean !== null && sonnetRagN > 0
      ? {
          label: `Sonnet 4.6 (RAG, ${sonnetRagN}/49)`,
          delta: sonnetRagWithCorpusMean - sonnetRagBaseMean,
          base: sonnetRagBaseMean,
          withCorpus: sonnetRagWithCorpusMean,
          n: sonnetRagN,
        }
      : null,
  ].filter((x): x is { label: string; delta: number; base: number; withCorpus: number; n: number } => x !== null);

  return (
    <main className="min-h-screen fade-in">
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-12 border-b border-line">
          <Link href="/" className="font-semibold tracking-tight text-[0.95rem]">
            ← The Soul Problem
          </Link>
          <div className="text-[0.85rem] text-muted">Leaderboard</div>
        </header>

        <section className="mb-8 max-w-2xl">
          <h1 className="text-[2.2rem] font-semibold tracking-tight leading-[1.1] mb-4">
            How every model scores on grief writing.
          </h1>
          <p className="text-muted leading-[1.55]">
            Every response in the corpus, judged 0–100 against its scenario&apos;s rubric. Humans
            and LLMs on the same scale.
          </p>
        </section>

        {liftCallouts.length > 0 && (
          <section className="mb-10">
            <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-3">Corpus lift</div>
            <div className={`grid gap-3 ${liftCallouts.length === 1 ? 'grid-cols-1' : liftCallouts.length === 2 ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
              {liftCallouts.map(c => (
                <div key={c.label} className="rounded-lg border border-accent bg-accent-tint p-5">
                  <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-2">
                    {c.label}
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <div className="text-[2rem] font-semibold tracking-tight leading-none tabular-nums text-accent">
                      {c.delta >= 0 ? '+' : ''}{c.delta.toFixed(1)}
                    </div>
                    <div className="font-mono text-[0.78rem] text-muted tabular-nums">
                      {c.base.toFixed(1)} → {c.withCorpus.toFixed(1)}
                    </div>
                  </div>
                  <p className="text-[0.82rem] text-muted leading-[1.5] mt-3">
                    {c.delta >= 0 ? 'points lift' : 'points change'} from the corpus, across {c.n} scenarios.
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[0.82rem] text-faint mt-3 max-w-2xl">
              For each model, we compare its score on a scenario alone vs. the same model on the same scenario
              with the public corpus as in-context examples. Same judge, same scenarios — only the conditioning changes.
            </p>
          </section>
        )}

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
                <Bar
                  score={r.score}
                  accent={r.isHuman || r.isLift}
                  baseScore={'baseForLift' in r && typeof (r as any).baseForLift === 'number' ? (r as any).baseForLift : undefined}
                />
                <div className="text-right">
                  <div className="font-mono text-sm tabular-nums" style={{ fontWeight: 500 }}>
                    {r.score.toFixed(1)}
                  </div>
                  {'baseForLift' in r && typeof (r as any).baseForLift === 'number' && (
                    <div className="font-mono text-[0.7rem] text-accent tabular-nums mt-0.5">
                      +{(r.score - (r as any).baseForLift).toFixed(1)}
                    </div>
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
