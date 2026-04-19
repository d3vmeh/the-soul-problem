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
    <div className="relative flex-1 h-10 bg-paper-warm rounded-none border border-rule-soft overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 bar-grow ${accent ? 'bg-accent' : 'bg-ink'}`}
        style={{ width: `${pct}%` }}
      />
      <div className="absolute inset-y-0 left-[25%] w-px bg-paper opacity-25" />
      <div className="absolute inset-y-0 left-[50%] w-px bg-paper opacity-40" />
      <div className="absolute inset-y-0 left-[75%] w-px bg-paper opacity-25" />
    </div>
  );
}

function Row({
  numeral,
  label,
  sub,
  score,
  accent,
}: {
  numeral: string;
  label: string;
  sub: string;
  score: number;
  accent?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[32px_1fr_320px_60px] gap-4 items-center py-4 border-b border-rule-soft ${accent ? 'bg-accent-wash -mx-4 px-4' : ''}`}>
      <span className="font-mono text-sm tabular-nums text-ink-whisper">{numeral}</span>
      <div>
        <div
          className="font-display text-[1.1rem] leading-tight text-ink-deep"
          style={{ fontVariationSettings: '"SOFT" 70, "opsz" 48, "wght" 480' }}
        >
          {label}
        </div>
        <div className="eyebrow mt-1 opacity-80">{sub}</div>
      </div>
      <Bar score={score} accent={accent} />
      <div className="font-mono text-[1rem] tabular-nums text-ink-deep text-right" style={{ fontWeight: 500 }}>
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
    return () => {
      cancelled = true;
    };
  }, [responseId]);

  if (busy) {
    return (
      <section className="border-y border-rule py-10 my-10">
        <p className="eyebrow mb-3">Measurement in progress</p>
        <h2
          className="font-display text-ink-deep text-[1.85rem] leading-[1.1] mb-4"
          style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 380' }}
        >
          Running Claude Haiku three times,<br />
          <em className="italic">then grading each.</em>
        </h2>
        <p className="text-ink-soft max-w-xl leading-[1.65] mb-4">
          Once on its own, once with your response as a single example, once with the whole public
          dataset. Same judge, same rubric. Takes about fifteen to thirty seconds.
        </p>
        <div className="inline-flex items-center gap-3 text-sm text-ink-faint font-mono">
          <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
          Computing…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="border-y border-rule py-8 my-10">
        <p className="eyebrow text-accent-deep mb-2">Could not compute</p>
        <p className="text-ink-soft">{error ?? 'unknown error'}</p>
      </section>
    );
  }

  const ownDelta = data.own_score !== null ? data.own_score - data.base_score : null;
  const datasetDelta = data.dataset_score - data.base_score;

  return (
    <section className="border-y border-rule py-10 my-10">
      <p className="eyebrow mb-3">The lift experiment</p>
      <h2
        className="font-display text-ink-deep text-[2.1rem] md:text-[2.6rem] leading-[1.02] mb-5"
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 340' }}
      >
        How your response<br />
        <em className="italic text-accent-deep">teaches the model.</em>
      </h2>
      <p className="text-ink-soft max-w-[42rem] leading-[1.7] mb-8">
        Claude Haiku answered the same scenario three times. Once cold. Once with your response as an
        example. Once with the whole public dataset in context. The judge was the same; the rubric was
        the same; only the prompt changed.
      </p>

      <div className="mt-6">
        <Row numeral="I" label="Haiku · cold" sub="no examples, baseline" score={data.base_score} />
        {data.own_score !== null && (
          <Row
            numeral="II"
            label="Haiku · with your response"
            sub="your response as a single example"
            score={data.own_score}
            accent
          />
        )}
        <Row
          numeral="III"
          label="Haiku · with dataset"
          sub={`${data.n_dataset_examples} human contribution${data.n_dataset_examples === 1 ? '' : 's'} in context`}
          score={data.dataset_score}
          accent
        />
        <Row numeral="IV" label="You" sub="judged directly against the rubric" score={yourScore} />
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-6 text-[0.95rem] leading-[1.7] text-ink-soft">
        {ownDelta !== null && (
          <p>
            With <strong className="text-ink-deep">just your response</strong> as an example, Haiku moved{' '}
            <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
              {ownDelta >= 0 ? '+' : ''}{ownDelta.toFixed(1)}
            </span>{' '}
            points vs its own baseline.
          </p>
        )}
        <p>
          With the <strong className="text-ink-deep">whole dataset</strong>, Haiku moved{' '}
          <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
            {datasetDelta >= 0 ? '+' : ''}{datasetDelta.toFixed(1)}
          </span>{' '}
          points.
        </p>
      </div>

      {data.n_dataset_examples < 3 && (
        <p className="text-xs text-ink-whisper italic mt-6 font-display" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 14, "wght" 380' }}>
          The dataset effect strengthens as more people contribute. Right now there {data.n_dataset_examples === 1 ? 'is' : 'are'} only {data.n_dataset_examples}{' '}
          contribution{data.n_dataset_examples === 1 ? '' : 's'} to draw from.
        </p>
      )}
    </section>
  );
}
