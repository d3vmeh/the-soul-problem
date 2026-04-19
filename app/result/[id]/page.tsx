import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';

function scoreBand(n: number): { label: string; cls: string } {
  if (n >= 85) return { label: 'Strong', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
  if (n >= 70) return { label: 'Solid', cls: 'bg-blue-100 text-blue-900 border-blue-200' };
  if (n >= 50) return { label: 'Mixed', cls: 'bg-amber-100 text-amber-900 border-amber-200' };
  return { label: 'Weak', cls: 'bg-rose-100 text-rose-900 border-rose-200' };
}

function Bar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden w-full">
      <div className="h-full bg-neutral-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const responseId = Number(id);
  if (!Number.isFinite(responseId)) notFound();

  const db = supabaseService();
  const { data: response } = await db
    .from('responses')
    .select('id, text, model, scenario_id, scenarios(prompt, metadata)')
    .eq('id', responseId)
    .single();
  if (!response) notFound();

  const { data: judgment } = await db
    .from('judgments')
    .select('*')
    .eq('response_id', responseId)
    .maybeSingle();

  const scenario = (response as any).scenarios;
  const md = (scenario?.metadata ?? {}) as any;
  const isHuman = response.model.startsWith('human');
  const isPublic = response.model === 'human:public';

  if (!judgment) {
    return (
      <main className="min-h-screen bg-white text-neutral-900">
        <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
          <h1 className="text-3xl font-semibold">Your response was saved</h1>
          <p className="text-neutral-700">The judge didn't return a score this time. You can try again.</p>
          <Link href={`/try/${response.scenario_id}`} className="inline-block px-5 py-2 rounded-lg bg-neutral-900 text-white">
            Try again
          </Link>
        </div>
      </main>
    );
  }

  const band = scoreBand(judgment.overall_score);
  const positive = (judgment.positive_scores ?? {}) as Record<string, number>;
  const negative = (judgment.negative_scores ?? {}) as Record<string, number>;
  const dominant = (judgment.dominant_criteria ?? []) as string[];
  const dominantSet = new Set(dominant.map(s => s.toLowerCase()));

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/try" className="text-sm text-neutral-500 hover:text-neutral-700">
            ← scenarios
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            {isHuman ? 'Your score' : 'Model score'}
          </h1>
        </header>

        <section className={`rounded-xl border p-6 ${band.cls}`}>
          <div className="flex items-baseline gap-4">
            <div className="text-5xl font-semibold">{judgment.overall_score.toFixed(1)}</div>
            <div className="text-sm uppercase tracking-wider">/ 100</div>
            <div className="ml-auto text-sm uppercase tracking-wider">{band.label}</div>
          </div>
          <p className="mt-4 text-sm leading-relaxed">{judgment.rationale}</p>
          <div className="mt-3 text-xs opacity-75">
            Judged by {judgment.judge_model}
            {isHuman && <> · {isPublic ? 'Contributed to public dataset' : 'Private submission'}</>}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What you were scored on</h2>
          <p className="text-sm text-neutral-600">
            Each criterion 1–10. Dominant criteria (bold) count double in the overall score.
          </p>
          <div className="grid gap-3">
            <div className="text-xs uppercase tracking-wider text-neutral-500">Positive — higher is better</div>
            {Object.entries(positive).map(([label, score]) => {
              const isDominant = dominantSet.has(label.toLowerCase());
              return (
                <div key={label} className="grid grid-cols-[1fr_auto_90px] gap-3 items-center">
                  <div className={`text-sm ${isDominant ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                    {label}
                  </div>
                  <div className="text-sm tabular-nums text-neutral-500">{score}/10</div>
                  <Bar score={score} />
                </div>
              );
            })}

            <div className="text-xs uppercase tracking-wider text-neutral-500 mt-3">Negative — lower is better</div>
            {Object.entries(negative).map(([label, score]) => {
              const isDominant = dominantSet.has(label.toLowerCase());
              return (
                <div key={label} className="grid grid-cols-[1fr_auto_90px] gap-3 items-center">
                  <div className={`text-sm ${isDominant ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                    {label}
                  </div>
                  <div className="text-sm tabular-nums text-neutral-500">{score}/10</div>
                  <Bar score={score} />
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Your response</h2>
          <pre className="whitespace-pre-wrap bg-neutral-50 border border-neutral-200 rounded-lg p-5 text-sm text-neutral-800 font-sans">
            {response.text}
          </pre>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">The scenario</h2>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wider text-neutral-500">
            {md.subcategory && <span className="rounded bg-neutral-100 px-2 py-0.5">{md.subcategory.replace(/_/g, ' ')}</span>}
            {md.medium && <span className="rounded bg-neutral-100 px-2 py-0.5">{md.medium.replace(/_/g, ' ')}</span>}
          </div>
          <pre className="whitespace-pre-wrap bg-white border border-neutral-200 rounded-lg p-5 text-sm text-neutral-700 font-sans">
            {scenario?.prompt}
          </pre>
        </section>

        <div className="flex gap-3 pt-2">
          <Link href={`/try/${response.scenario_id}`} className="px-5 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-sm">
            Try this scenario again
          </Link>
          <Link href="/try" className="px-5 py-2 rounded-lg bg-neutral-900 text-white text-sm">
            Try another scenario
          </Link>
        </div>
      </div>
    </main>
  );
}
