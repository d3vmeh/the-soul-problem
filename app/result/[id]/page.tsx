import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';
import ContributeButton from './contribute';

function scoreBand(n: number): { label: string; cls: string } {
  if (n >= 85) return { label: 'Strong', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
  if (n >= 70) return { label: 'Solid', cls: 'bg-blue-100 text-blue-900 border-blue-200' };
  if (n >= 50) return { label: 'Mixed', cls: 'bg-amber-100 text-amber-900 border-amber-200' };
  return { label: 'Weak', cls: 'bg-rose-100 text-rose-900 border-rose-200' };
}

function Bar({ score, max = 10, tone = 'neutral' }: { score: number; max?: number; tone?: 'neutral' | 'you' }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const bar = tone === 'you' ? 'bg-neutral-900' : 'bg-neutral-500';
  return (
    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden w-full">
      <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function modelLabel(model: string): string {
  if (model === 'human:public') return 'Human contributor';
  if (model === 'human:private') return 'Private submission';
  if (model === 'claude-opus-4-7') return 'Claude Opus 4.7';
  if (model === 'claude-sonnet-4-6') return 'Claude Sonnet 4.6';
  if (model === 'claude-haiku-4-5') return 'Claude Haiku 4.5';
  if (model === 'claude-opus-blunt') return 'Claude Opus (blunt)';
  return model;
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

  // Rankings: fetch every judgment for this scenario, joined with the model label.
  const { data: peers } = await db
    .from('judgments')
    .select('overall_score, response_id, responses!inner(model, scenario_id)')
    .eq('responses.scenario_id', response.scenario_id);

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

  type Peer = { overall_score: number; response_id: number; model: string };
  const peerRows: Peer[] = (peers ?? []).map((p: any) => ({
    overall_score: p.overall_score,
    response_id: p.response_id,
    model: p.responses.model,
  }));

  const myScore = judgment.overall_score;
  const llmPeers = peerRows.filter(p => p.model.startsWith('claude-'));
  const humanPublicPeers = peerRows.filter(p => p.model === 'human:public' && p.response_id !== responseId);
  const humanPublicAll = peerRows.filter(p => p.model === 'human:public');

  // Percentile among public humans INCLUDING this response (only if public).
  const rankingPool = isPublic ? humanPublicAll : [...humanPublicPeers, { overall_score: myScore, response_id: responseId, model: 'human:public' }];
  const sortedPool = [...rankingPool].sort((a, b) => b.overall_score - a.overall_score);
  const myRank = sortedPool.findIndex(p => p.response_id === responseId) + 1;
  const poolSize = sortedPool.length;
  const percentile = poolSize > 1 ? Math.round(((poolSize - myRank) / (poolSize - 1)) * 100) : 100;

  const bestLlm = llmPeers.reduce((a, b) => (b.overall_score > a.overall_score ? b : a), { overall_score: -1, response_id: -1, model: '' });
  const deltaVsBestLlm = myScore - bestLlm.overall_score;

  // Scenario-wide dataset-impact stats (public humans only)
  const contributedCount = humanPublicAll.length;
  const contributedMean =
    contributedCount > 0
      ? humanPublicAll.reduce((a, b) => a + b.overall_score, 0) / contributedCount
      : null;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
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
            <div className="text-5xl font-semibold">{myScore.toFixed(1)}</div>
            <div className="text-sm uppercase tracking-wider">/ 100</div>
            <div className="ml-auto text-sm uppercase tracking-wider">{band.label}</div>
          </div>
          <p className="mt-4 text-sm leading-relaxed">{judgment.rationale}</p>
          <div className="mt-3 text-xs opacity-75">
            Judged by {judgment.judge_model}
            {isHuman && <> · {isPublic ? 'Contributed to the public dataset' : 'Private submission'}</>}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Where you rank on this scenario</h2>
          <div className="space-y-3">
            {/* Your score, highlighted */}
            <div className="grid grid-cols-[200px_auto_1fr_60px] gap-3 items-center">
              <div className="text-sm font-semibold text-neutral-900">You</div>
              <div className="text-xs uppercase tracking-wider text-neutral-500">
                {isHuman ? (isPublic ? 'public' : 'private') : 'model'}
              </div>
              <Bar score={myScore} max={100} tone="you" />
              <div className="text-sm tabular-nums text-neutral-900 text-right">{myScore.toFixed(1)}</div>
            </div>
            {/* LLM baselines */}
            {llmPeers
              .sort((a, b) => b.overall_score - a.overall_score)
              .map(p => (
                <div key={p.response_id} className="grid grid-cols-[200px_auto_1fr_60px] gap-3 items-center">
                  <div className="text-sm text-neutral-700">{modelLabel(p.model)}</div>
                  <div className="text-xs uppercase tracking-wider text-neutral-500">llm</div>
                  <Bar score={p.overall_score} max={100} />
                  <div className="text-sm tabular-nums text-neutral-700 text-right">{p.overall_score.toFixed(1)}</div>
                </div>
              ))}
            {/* Other public humans */}
            {humanPublicPeers
              .sort((a, b) => b.overall_score - a.overall_score)
              .slice(0, 5)
              .map((p, i) => (
                <div key={p.response_id} className="grid grid-cols-[200px_auto_1fr_60px] gap-3 items-center">
                  <div className="text-sm text-neutral-700">Human #{i + 1}</div>
                  <div className="text-xs uppercase tracking-wider text-neutral-500">public</div>
                  <Bar score={p.overall_score} max={100} />
                  <div className="text-sm tabular-nums text-neutral-700 text-right">{p.overall_score.toFixed(1)}</div>
                </div>
              ))}
          </div>

          <div className="text-sm text-neutral-600 pt-2 space-y-1">
            {bestLlm.response_id > 0 && (
              <p>
                {deltaVsBestLlm >= 0 ? (
                  <>You beat the best LLM on this scenario by <strong>{deltaVsBestLlm.toFixed(1)} points</strong>.</>
                ) : (
                  <>Best LLM on this scenario scored <strong>{Math.abs(deltaVsBestLlm).toFixed(1)} points higher</strong> than you.</>
                )}
              </p>
            )}
            {poolSize > 1 && (
              <p>
                Among <strong>{poolSize}</strong> human contributor{poolSize === 1 ? '' : 's'} on this scenario,
                {' '}your response ranks <strong>#{myRank}</strong> ({percentile}th percentile).
              </p>
            )}
          </div>
        </section>

        {isHuman && !isPublic && (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-emerald-900">
              Keep your response private, or contribute it?
            </h2>
            <p className="text-sm text-emerald-900/80">
              Your response currently lives only on this page. If you contribute it, it joins the public dataset —
              a growing, rubric-graded corpus of how real people handle the hardest messages to write. No names are
              attached. Only the response text, the scenario, and the score.
            </p>
            <ContributeButton responseId={responseId} />
          </section>
        )}

        {isHuman && isPublic && (
          <section className="rounded-xl border border-neutral-200 bg-white p-6 space-y-3">
            <h2 className="text-lg font-semibold">You're in the dataset</h2>
            <p className="text-sm text-neutral-700">
              There {contributedCount === 1 ? 'is' : 'are'} now <strong>{contributedCount}</strong>{' '}
              human contribution{contributedCount === 1 ? '' : 's'} to this scenario.
              {contributedMean !== null && (
                <> The mean score across contributors is <strong>{contributedMean.toFixed(1)}</strong>.</>
              )}{' '}
              Your response is one signal making the dataset stronger.
            </p>
            <Link href="/dataset" className="inline-block text-sm text-neutral-900 underline underline-offset-2">
              Browse the dataset →
            </Link>
          </section>
        )}

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
