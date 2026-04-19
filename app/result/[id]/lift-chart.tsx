'use client';
import { useEffect, useState } from 'react';

type LiftData = {
  scenario_id: number;
  user_response_id: number | null;
  n_dataset_examples: number;
  base_score: number;
  base_text: string;
  own_score: number | null;
  own_text: string | null;
  dataset_score: number;
  dataset_text: string;
  student_model: string;
  judge_model: string;
};

function scoreColorBar(n: number): string {
  // Red -> amber -> green across 0-100. Mimics the reference leaderboard aesthetic.
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
  highlight,
}: {
  label: string;
  sublabel?: string;
  score: number;
  highlight?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className={`grid grid-cols-[240px_1fr] gap-3 items-center py-2 ${highlight ? 'bg-neutral-50 rounded-md px-3' : 'px-3'}`}>
      <div>
        <div className={`text-sm ${highlight ? 'font-semibold text-neutral-900' : 'text-neutral-800'}`}>
          {label}
        </div>
        {sublabel && <div className="text-xs text-neutral-500 mt-0.5">{sublabel}</div>}
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

export default function LiftChart({
  responseId,
  yourScore,
}: {
  responseId: number;
  yourScore: number;
}) {
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
    return () => {
      cancelled = true;
    };
  }, [responseId]);

  if (busy) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold">How your response teaches the model</h2>
        <p className="text-sm text-neutral-600">
          Running Claude Haiku on this scenario three times — once with nothing, once with just your response
          as an example, once with the whole public dataset. Then grading all three. This takes ~15–30 seconds.
        </p>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <div className="h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-800 animate-spin" />
          Computing impact…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 space-y-2">
        <h2 className="text-lg font-semibold text-rose-900">Couldn't compute impact</h2>
        <p className="text-sm text-rose-900">{error ?? 'unknown error'}</p>
      </section>
    );
  }

  const ownDelta = data.own_score !== null ? data.own_score - data.base_score : null;
  const datasetDelta = data.dataset_score - data.base_score;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">How your response teaches the model</h2>
        <p className="text-sm text-neutral-600">
          Claude Haiku's score on this scenario under three conditions. Higher is better. Judged by Claude Sonnet 4.6.
        </p>
      </div>

      <div className="space-y-1">
        <Row label="Haiku (no examples)" sublabel="baseline" score={data.base_score} />
        {data.own_score !== null && (
          <Row
            label="Haiku + your response"
            sublabel={`your response used as the single example`}
            score={data.own_score}
            highlight
          />
        )}
        <Row
          label="Haiku + dataset"
          sublabel={`${data.n_dataset_examples} human contribution${data.n_dataset_examples === 1 ? '' : 's'} used as examples`}
          score={data.dataset_score}
          highlight
        />
        <Row label="You" sublabel="your response, judged directly" score={yourScore} />
      </div>

      <div className="border-t border-neutral-200 pt-4 text-sm text-neutral-700 space-y-1">
        {ownDelta !== null && (
          <p>
            With <strong>just your response</strong> as an example, Haiku went{' '}
            <strong>{ownDelta >= 0 ? '+' : ''}{ownDelta.toFixed(1)}</strong> vs no-example baseline.
          </p>
        )}
        <p>
          With the <strong>whole dataset</strong>, Haiku went{' '}
          <strong>{datasetDelta >= 0 ? '+' : ''}{datasetDelta.toFixed(1)}</strong> vs no-example baseline.
        </p>
        {data.n_dataset_examples < 3 && (
          <p className="text-xs text-neutral-500 italic pt-1">
            The dataset effect will get stronger as more people contribute. Right now it has {data.n_dataset_examples} example
            {data.n_dataset_examples === 1 ? '' : 's'}.
          </p>
        )}
      </div>
    </section>
  );
}
