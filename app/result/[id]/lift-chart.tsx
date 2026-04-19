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

function Row({
  label,
  sub,
  score,
  accent,
}: {
  label: string;
  sub: string;
  score: number;
  accent?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[1fr_300px_60px] gap-4 items-center py-3 border-b border-rule-hair ${accent ? 'bg-accent-wash -mx-3 px-3' : ''}`}>
      <div>
        <div
          className="font-display text-[1.05rem] leading-tight text-ink-deep"
          style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 530' }}
        >
          {label}
        </div>
        <div className="text-[0.82rem] text-ink-faint mt-0.5">{sub}</div>
      </div>
      <Bar score={score} accent={accent} />
      <div className="font-mono text-sm tabular-nums text-ink-deep text-right" style={{ fontWeight: 500 }}>
        {score.toFixed(1)}
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
    return () => { cancelled = true; };
  }, [responseId]);

  if (busy) {
    return (
      <section className="border-y border-rule py-10 my-10">
        <h2
          className="font-display text-ink-deep text-[1.7rem] leading-[1.15] mb-3"
          style={{ fontVariationSettings: '"SOFT" 30, "opsz" 48, "wght" 500' }}
        >
          How your response teaches the model
        </h2>
        <p className="text-ink-soft text-[0.95rem] leading-[1.65] max-w-[40rem] mb-5">
          Running Claude Haiku on this scenario three times — once alone, once with your response as
          an example, once with the whole corpus. Judged by Sonnet. About 15–30 seconds.
        </p>
        <div className="inline-flex items-center gap-2 text-sm text-ink-faint font-mono">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Computing…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="border-y border-rule py-6 my-10">
        <h2 className="font-display text-ink-deep text-[1.4rem] mb-2">Couldn&apos;t compute impact</h2>
        <p className="text-ink-soft">{error ?? 'unknown error'}</p>
      </section>
    );
  }

  const ownDelta = data.own_score !== null ? data.own_score - data.base_score : null;
  const datasetDelta = data.dataset_score - data.base_score;

  return (
    <section className="border-y border-rule py-10 my-12">
      <h2
        className="font-display text-ink-deep text-[1.9rem] md:text-[2.2rem] leading-[1.05] mb-4"
        style={{ fontVariationSettings: '"SOFT" 30, "opsz" 48, "wght" 450' }}
      >
        How your response teaches a weaker model
      </h2>
      <p className="text-ink-soft text-[0.98rem] leading-[1.65] max-w-[42rem] mb-8">
        Claude Haiku 4.5 answered this scenario three times — alone, with your response as an
        example, and with the full corpus in context. Same rubric, same judge each time.
      </p>

      <div>
        <div className="grid grid-cols-[1fr_300px_60px] gap-4 py-2 border-b border-rule-soft items-end">
          <div className="tag">Condition</div>
          <div className="tag">Score</div>
          <div className="tag text-right">Mean</div>
        </div>
        <Row label="Haiku alone" sub="no examples, baseline" score={data.base_score} />
        {data.own_score !== null && (
          <Row
            label="Haiku + your response"
            sub="your response as a single example"
            score={data.own_score}
            accent
          />
        )}
        <Row
          label="Haiku + corpus"
          sub={`${data.n_dataset_examples} contribution${data.n_dataset_examples === 1 ? '' : 's'} as examples`}
          score={data.dataset_score}
          accent
        />
        <Row label="You" sub="your response, judged directly" score={yourScore} />
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-5 text-[0.93rem] leading-[1.7] text-ink-soft">
        {ownDelta !== null && (
          <p>
            With your response as the single example, Haiku moved{' '}
            <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
              {ownDelta >= 0 ? '+' : ''}{ownDelta.toFixed(1)}
            </span>{' '}
            points versus the baseline.
          </p>
        )}
        <p>
          With the whole corpus, Haiku moved{' '}
          <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
            {datasetDelta >= 0 ? '+' : ''}{datasetDelta.toFixed(1)}
          </span>{' '}
          points.
        </p>
      </div>

      {data.n_dataset_examples < 3 && (
        <p className="text-[0.85rem] text-ink-faint italic mt-5 font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 400' }}>
          With only {data.n_dataset_examples} corpus example{data.n_dataset_examples === 1 ? '' : 's'}, the effect is noisy. It gets stronger as more people contribute.
        </p>
      )}
    </section>
  );
}
