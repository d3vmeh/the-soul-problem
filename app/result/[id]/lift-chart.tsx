'use client';
import { useEffect, useState } from 'react';

type LiftData = {
  scenario_id: number;
  user_response_id: number | null;
  n_dataset_examples: number;
  base_score: number;
  own_score: number | null;
  dataset_score: number;
  student_model: string;
  judge_model: string;
};

function Bar({ score, accent }: { score: number; accent?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative flex-1 h-5 bg-surface-3 rounded overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 bar-grow rounded ${accent ? 'bg-accent' : 'bg-bar'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Row({ label, sub, score, accent }: { label: string; sub: string; score: number; accent?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_240px_52px] gap-3 items-center py-2.5 border-b border-line-subtle last:border-0 ${accent ? 'bg-accent-tint -mx-3 px-3' : ''}`}>
      <div>
        <div className="text-[0.9rem] font-medium">{label}</div>
        <div className="text-[0.78rem] text-faint">{sub}</div>
      </div>
      <Bar score={score} accent={accent} />
      <div className="font-mono text-sm tabular-nums text-right" style={{ fontWeight: 500 }}>
        {score.toFixed(1)}
      </div>
    </div>
  );
}

export default function LiftChart({ responseId, yourScore }: { responseId: number; yourScore: number }) {
  const [data, setData] = useState<LiftData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lift', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ response_id: responseId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'failed');
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [responseId]);

  if (busy) {
    return (
      <section className="rounded-lg border border-line p-5 my-8">
        <h2 className="text-[1.15rem] font-semibold tracking-tight mb-2">How your response teaches the model</h2>
        <p className="text-muted text-[0.9rem] leading-[1.55] mb-4">
          Running Claude Haiku on this scenario three times — alone, with your response, and with the
          whole corpus — then judging each. About 15–30 seconds.
        </p>
        <div className="flex items-center gap-2 text-[0.85rem] text-faint font-mono">
          <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Computing…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-5 my-8">
        <h2 className="text-[1.05rem] font-semibold text-red-900 mb-1">Couldn&apos;t compute impact</h2>
        <p className="text-red-800 text-[0.9rem]">{error ?? 'unknown error'}</p>
      </section>
    );
  }

  const ownDelta = data.own_score !== null ? data.own_score - data.base_score : null;
  const datasetDelta = data.dataset_score - data.base_score;

  return (
    <section className="rounded-lg border border-line p-5 my-8">
      <h2 className="text-[1.15rem] font-semibold tracking-tight mb-2">How your response teaches a weaker model</h2>
      <p className="text-muted text-[0.9rem] leading-[1.55] mb-5">
        Claude Haiku 4.5 answered this scenario three times — alone, with your response, and with the
        full corpus — all judged by Sonnet.
      </p>

      <div className="rounded-md border border-line-subtle overflow-hidden">
        <div className="grid grid-cols-[1fr_240px_52px] gap-3 px-3 py-2 border-b border-line bg-surface text-[0.72rem] text-faint uppercase tracking-wide">
          <div>Condition</div>
          <div>Score</div>
          <div className="text-right">Mean</div>
        </div>
        <div className="px-3">
          <Row label="Haiku alone" sub="baseline, no examples" score={data.base_score} />
          {data.own_score !== null && (
            <Row label="Haiku + your response" sub="your response as a single example" score={data.own_score} accent />
          )}
          <Row
            label="Haiku + corpus"
            sub={`${data.n_dataset_examples} contribution${data.n_dataset_examples === 1 ? '' : 's'} as examples`}
            score={data.dataset_score}
            accent
          />
          <Row label="You" sub="your response, judged directly" score={yourScore} />
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-3 text-[0.88rem] text-muted leading-[1.55]">
        {ownDelta !== null && (
          <p>
            With just your response,{' '}
            <span className="font-mono text-accent tabular-nums font-medium">
              {ownDelta >= 0 ? '+' : ''}{ownDelta.toFixed(1)}
            </span>{' '}
            vs baseline.
          </p>
        )}
        <p>
          With the whole corpus,{' '}
          <span className="font-mono text-accent tabular-nums font-medium">
            {datasetDelta >= 0 ? '+' : ''}{datasetDelta.toFixed(1)}
          </span>{' '}
          vs baseline.
        </p>
      </div>

      {data.n_dataset_examples < 3 && (
        <p className="text-[0.78rem] text-faint mt-3">
          With only {data.n_dataset_examples} corpus example{data.n_dataset_examples === 1 ? '' : 's'}, the effect is noisy; it strengthens as more people contribute.
        </p>
      )}
    </section>
  );
}
