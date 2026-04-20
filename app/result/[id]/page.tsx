import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';
import ContributeButton from './contribute';
import LiftChart from './lift-chart';

function modelDisplay(model: string): string {
  if (model === 'human:public') return 'Human contributor';
  if (model === 'human:private') return 'Private submission';
  if (model === 'claude-opus-4-7') return 'Claude Opus 4.7';
  if (model === 'claude-sonnet-4-6') return 'Claude Sonnet 4.6';
  if (model === 'claude-haiku-4-5') return 'Claude Haiku 4.5';
  if (model === 'claude-opus-blunt') return 'Claude Opus (blunt)';
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model === 'gpt-4o-mini') return 'GPT-4o mini';
  if (model === 'gpt-5.4') return 'GPT-5.4';
  if (model === 'gpt-5.4-mini') return 'GPT-5.4 mini';
  return model;
}

function band(n: number): string {
  if (n >= 85) return 'Strong';
  if (n >= 70) return 'Solid';
  if (n >= 50) return 'Mixed';
  return 'Weak';
}

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
function SmallBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return (
    <div className="relative w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-bar rounded-full" style={{ width: `${pct}%` }} />
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

  const { data: peers } = await db
    .from('judgments')
    .select('overall_score, response_id, responses!inner(model, scenario_id)')
    .eq('responses.scenario_id', response.scenario_id);

  const scenario = (response as any).scenarios;
  const md = (scenario?.metadata ?? {}) as any;
  const isHuman = response.model.startsWith('human');
  const isPublic = response.model === 'human:public';
  const meta = [md.subcategory, md.medium].filter(Boolean).map(s => String(s).replace(/_/g, ' ')).join(' · ');

  if (!judgment) {
    return (
      <main className="min-h-screen fade-in">
        <div className="max-w-2xl mx-auto px-6 pt-10 pb-20">
          <header className="flex items-center justify-between pb-6 mb-8 border-b border-line">
            <Link href="/" className="font-semibold tracking-tight text-[0.95rem]">← The Soul Problem</Link>
          </header>
          <h1 className="text-[2rem] font-semibold tracking-tight mb-3">Your response was saved.</h1>
          <p className="text-muted mb-5">The judge didn&apos;t return a score this time. You can try again.</p>
          <Link href={`/try/${response.scenario_id}`} className="btn btn-primary">Try again</Link>
        </div>
      </main>
    );
  }

  type Peer = { overall_score: number; response_id: number; model: string };
  const peerRows: Peer[] = (peers ?? []).map((p: any) => ({
    overall_score: p.overall_score,
    response_id: p.response_id,
    model: p.responses.model,
  }));

  const myScore = judgment.overall_score;
  const llmPeers = peerRows.filter(p => p.model.startsWith('claude-') || p.model.startsWith('gpt-'));
  const humanPublicPeers = peerRows.filter(p => p.model === 'human:public' && p.response_id !== responseId);
  const humanPublicAll = peerRows.filter(p => p.model === 'human:public');

  const rankingPool = isPublic
    ? humanPublicAll
    : [...humanPublicPeers, { overall_score: myScore, response_id: responseId, model: 'human:public' }];
  const sortedPool = [...rankingPool].sort((a, b) => b.overall_score - a.overall_score);
  const myRank = sortedPool.findIndex(p => p.response_id === responseId) + 1;
  const poolSize = sortedPool.length;
  const percentile = poolSize > 1 ? Math.round(((poolSize - myRank) / (poolSize - 1)) * 100) : 100;

  const bestLlm = llmPeers.reduce(
    (a, b) => (b.overall_score > a.overall_score ? b : a),
    { overall_score: -1, response_id: -1, model: '' }
  );
  const deltaVsBestLlm = myScore - bestLlm.overall_score;

  const contributedCount = humanPublicAll.length;
  const contributedMean =
    contributedCount > 0
      ? humanPublicAll.reduce((a, b) => a + b.overall_score, 0) / contributedCount
      : null;

  const positive = (judgment.positive_scores ?? {}) as Record<string, number>;
  const negative = (judgment.negative_scores ?? {}) as Record<string, number>;
  const dominant = (judgment.dominant_criteria ?? []) as string[];
  const dominantSet = new Set(dominant.map(s => s.toLowerCase()));

  return (
    <main className="min-h-screen fade-in">
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-10 border-b border-line">
          <Link href="/try" className="font-semibold tracking-tight text-[0.95rem]">← Scenarios</Link>
          <div className="text-[0.85rem] text-muted">
            {isHuman ? (isPublic ? 'Public' : 'Private draft') : 'Model baseline'}
          </div>
        </header>

        <section className="mb-10">
          <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-3">Your score</div>
          <div className="flex items-baseline gap-5 flex-wrap">
            <span className="text-[5rem] md:text-[6rem] font-semibold tracking-tight leading-none tabular-nums">
              {myScore.toFixed(1)}
            </span>
            <div className="flex flex-col gap-1 pb-2">
              <span className="text-sm text-faint">/ 100</span>
              <span className="text-sm font-medium text-accent">{band(myScore)}</span>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-line-subtle bg-surface p-4 max-w-xl">
            <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-2">Judge rationale</div>
            <p className="text-[0.95rem] leading-[1.6] text-text">{judgment.rationale}</p>
            <p className="text-[0.78rem] text-faint mt-2">{judgment.judge_model}</p>
          </div>
        </section>

        <section className="rounded-lg border border-line p-5 mb-8">
          <h2 className="text-[1.15rem] font-semibold tracking-tight mb-4">Where you stand on this scenario</h2>
          <div className="rounded-md border border-line-subtle overflow-hidden">
            <div className="grid grid-cols-[1fr_220px_52px] gap-3 px-3 py-2 border-b border-line bg-surface text-[0.72rem] text-faint uppercase tracking-wide">
              <div>Respondent</div>
              <div>Score</div>
              <div className="text-right">Mean</div>
            </div>
            <div className="px-3">
              <div className="grid grid-cols-[1fr_220px_52px] gap-3 items-center py-2.5 bg-accent-tint -mx-3 px-3 border-b border-line-subtle">
                <div className="text-[0.9rem] font-semibold">You</div>
                <Bar score={myScore} accent />
                <div className="font-mono text-sm tabular-nums text-right font-medium">{myScore.toFixed(1)}</div>
              </div>
              {llmPeers
                .sort((a, b) => b.overall_score - a.overall_score)
                .map(p => (
                  <div key={p.response_id} className="grid grid-cols-[1fr_220px_52px] gap-3 items-center py-2.5 border-b border-line-subtle last:border-0">
                    <div className="text-[0.9rem] text-muted">{modelDisplay(p.model)}</div>
                    <Bar score={p.overall_score} />
                    <div className="font-mono text-sm tabular-nums text-right text-muted">{p.overall_score.toFixed(1)}</div>
                  </div>
                ))}
              {humanPublicPeers
                .sort((a, b) => b.overall_score - a.overall_score)
                .slice(0, 5)
                .map((p, i) => (
                  <div key={p.response_id} className="grid grid-cols-[1fr_220px_52px] gap-3 items-center py-2.5 border-b border-line-subtle last:border-0">
                    <div className="text-[0.9rem] text-muted">Human #{i + 1}</div>
                    <Bar score={p.overall_score} />
                    <div className="font-mono text-sm tabular-nums text-right text-muted">{p.overall_score.toFixed(1)}</div>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 space-y-1 text-[0.88rem] text-muted leading-[1.55]">
            {bestLlm.response_id > 0 && (
              <p>
                {deltaVsBestLlm >= 0 ? (
                  <>You beat the strongest LLM by{' '}
                    <span className="font-mono tabular-nums font-medium text-accent">{deltaVsBestLlm.toFixed(1)}</span> points.</>
                ) : (
                  <>The strongest LLM scored{' '}
                    <span className="font-mono tabular-nums font-medium text-accent">{Math.abs(deltaVsBestLlm).toFixed(1)}</span> higher.</>
                )}
              </p>
            )}
            {poolSize > 1 && (
              <p>
                Among <strong className="text-text font-medium">{poolSize}</strong> human contributor{poolSize === 1 ? '' : 's'},
                you rank <strong className="text-text font-medium">#{myRank}</strong> ({percentile}th percentile).
              </p>
            )}
          </div>
        </section>

        {isHuman && <LiftChart responseId={responseId} yourScore={myScore} />}

        {isHuman && !isPublic && (
          <section className="rounded-lg border border-accent bg-accent-tint p-5 mb-8">
            <h2 className="text-[1.1rem] font-semibold tracking-tight mb-2">Contribute this response</h2>
            <p className="text-muted text-[0.9rem] leading-[1.55] mb-4">
              Private by default. If you opt in, it joins the public corpus under anonymous
              attribution.
            </p>
            <ContributeButton responseId={responseId} />
          </section>
        )}

        {isHuman && isPublic && (
          <section className="rounded-lg border border-line p-5 mb-8">
            <h2 className="text-[1.05rem] font-semibold mb-2">You&apos;re in the corpus</h2>
            <p className="text-muted text-[0.9rem] leading-[1.55]">
              <strong className="text-text font-medium">{contributedCount}</strong> public contribution{contributedCount === 1 ? '' : 's'} on this scenario.
              {contributedMean !== null && (
                <> Contributor mean: <strong className="text-text font-medium">{contributedMean.toFixed(1)}</strong>.</>
              )}{' '}
              <Link href="/dataset" className="link">Browse →</Link>
            </p>
          </section>
        )}

        <section className="rounded-lg border border-line p-5 mb-8">
          <h2 className="text-[1.1rem] font-semibold tracking-tight mb-1">Rubric breakdown</h2>
          <p className="text-[0.82rem] text-faint mb-5">Dominant criteria (bold) count double.</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-3">Positive</div>
              <div className="space-y-2.5">
                {Object.entries(positive).map(([label, score]) => {
                  const isDom = dominantSet.has(label.toLowerCase());
                  return (
                    <div key={label} className="grid grid-cols-[1fr_auto_84px] gap-3 items-center">
                      <div className={`text-[0.85rem] leading-snug ${isDom ? 'font-semibold text-text' : 'text-muted'}`}>
                        {label}
                      </div>
                      <div className="font-mono text-xs tabular-nums text-faint w-6 text-right">{score}</div>
                      <SmallBar score={score} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-3">Negative</div>
              <div className="space-y-2.5">
                {Object.entries(negative).map(([label, score]) => {
                  const isDom = dominantSet.has(label.toLowerCase());
                  return (
                    <div key={label} className="grid grid-cols-[1fr_auto_84px] gap-3 items-center">
                      <div className={`text-[0.85rem] leading-snug ${isDom ? 'font-semibold text-text' : 'text-muted'}`}>
                        {label}
                      </div>
                      <div className="font-mono text-xs tabular-nums text-faint w-6 text-right">{score}</div>
                      <SmallBar score={score} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line-subtle bg-surface p-5 mb-4">
          <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-3">Your response</div>
          <pre className="whitespace-pre-wrap text-[0.95rem] leading-[1.6] text-text font-sans">{response.text}</pre>
        </section>

        <section className="rounded-lg border border-line-subtle bg-surface p-5 mb-8">
          {meta && <div className="text-[0.78rem] text-faint uppercase tracking-wide mb-3">The scenario — {meta}</div>}
          <pre className="whitespace-pre-wrap text-[0.92rem] leading-[1.6] text-muted font-sans">{scenario?.prompt}</pre>
        </section>

        <footer className="flex flex-wrap gap-2 pt-6 border-t border-line-subtle">
          <Link href={`/try/${response.scenario_id}`} className="btn btn-secondary">Retry this scenario</Link>
          <Link href="/try" className="btn btn-primary">Try another</Link>
        </footer>
      </div>
    </main>
  );
}
