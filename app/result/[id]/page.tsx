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
  if (model === 'claude-opus-blunt') return 'Claude Opus 4.7 (blunt)';
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model === 'gpt-4o-mini') return 'GPT-4o mini';
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
    <div className="relative flex-1 h-6 bg-paper-sunk border border-rule-hair overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 bar-grow ${accent ? 'bg-accent' : 'bg-ink'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SmallBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return (
    <div className="relative w-24 h-1.5 bg-paper-sunk overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${pct}%` }} />
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

  if (!judgment) {
    return (
      <main className="min-h-screen page-fade">
        <div className="max-w-[52rem] mx-auto px-8 md:px-14 pt-12 pb-24">
          <header className="flex items-baseline justify-between pb-5 mb-10 hairline">
            <Link href="/" className="font-display text-ink-deep text-[1.05rem]" style={{ fontVariationSettings: '"SOFT" 30, "wght" 600' }}>
              ← The Soul Problem
            </Link>
          </header>
          <h1 className="font-display text-ink-deep text-[2.2rem] leading-[1.05] mb-4" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 420' }}>
            Your response was saved.
          </h1>
          <p className="text-ink-soft mb-6">The judge didn&apos;t return a score this time. You can try again.</p>
          <Link href={`/try/${response.scenario_id}`} className="inline-block px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition">
            Try again
          </Link>
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
    <main className="min-h-screen page-fade">
      <div className="max-w-[54rem] mx-auto px-8 md:px-14 pt-12 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-12 hairline">
          <Link href="/try" className="font-display text-ink-deep text-[1.05rem]" style={{ fontVariationSettings: '"SOFT" 30, "wght" 600' }}>
            ← Scenarios
          </Link>
          <div className="text-[0.92rem] text-ink-soft">
            {isHuman ? (isPublic ? 'Public' : 'Private draft') : 'Model baseline'}
          </div>
        </header>

        <section className="mb-14">
          <p className="tag mb-3">Your score</p>
          <div className="flex items-baseline gap-6 flex-wrap">
            <div
              className="font-display text-ink-deep text-[6rem] md:text-[8rem] leading-[0.9] tabular-nums"
              style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 400' }}
            >
              {myScore.toFixed(1)}
            </div>
            <div className="flex flex-col gap-1 pb-3">
              <span className="text-ink-faint text-sm">/ 100</span>
              <span
                className="font-display text-[1.2rem] text-accent-deep italic"
                style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 500' }}
              >
                {band(myScore)}
              </span>
            </div>
          </div>
          <div className="border-l-2 border-accent pl-5 py-1 mt-8 max-w-[42rem]">
            <p className="tag mb-2">Judge rationale</p>
            <p className="font-display text-[1rem] leading-[1.65] text-ink-deep italic" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 420' }}>
              {judgment.rationale}
            </p>
            <p className="text-[0.82rem] text-ink-faint mt-3">— {judgment.judge_model}</p>
          </div>
        </section>

        <section className="border-y border-rule py-10">
          <h2
            className="font-display text-ink-deep text-[1.7rem] leading-[1.15] mb-5"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 48, "wght" 500' }}
          >
            Where you stand on this scenario
          </h2>

          <div>
            <div className="grid grid-cols-[1fr_260px_60px] gap-4 py-2 border-b border-rule-soft items-end">
              <div className="tag">Respondent</div>
              <div className="tag">Score</div>
              <div className="tag text-right">Mean</div>
            </div>
            <div className="grid grid-cols-[1fr_260px_60px] gap-4 items-center py-3 bg-accent-wash -mx-3 px-3 border-b border-rule-hair">
              <div className="font-display text-[1.05rem] text-ink-deep" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 560' }}>
                You
              </div>
              <Bar score={myScore} accent />
              <div className="font-mono text-sm tabular-nums text-right text-ink-deep" style={{ fontWeight: 500 }}>
                {myScore.toFixed(1)}
              </div>
            </div>
            {llmPeers
              .sort((a, b) => b.overall_score - a.overall_score)
              .map(p => (
                <div key={p.response_id} className="grid grid-cols-[1fr_260px_60px] gap-4 items-center py-3 border-b border-rule-hair">
                  <div className="text-[0.95rem] text-ink-soft font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 430' }}>
                    {modelDisplay(p.model)}
                  </div>
                  <Bar score={p.overall_score} />
                  <div className="font-mono text-sm tabular-nums text-right text-ink-soft">
                    {p.overall_score.toFixed(1)}
                  </div>
                </div>
              ))}
            {humanPublicPeers
              .sort((a, b) => b.overall_score - a.overall_score)
              .slice(0, 5)
              .map((p, i) => (
                <div key={p.response_id} className="grid grid-cols-[1fr_260px_60px] gap-4 items-center py-3 border-b border-rule-hair">
                  <div className="text-[0.95rem] text-ink-soft font-display italic" style={{ fontVariationSettings: '"SOFT" 30, "wght" 430' }}>
                    Human #{i + 1}
                  </div>
                  <Bar score={p.overall_score} />
                  <div className="font-mono text-sm tabular-nums text-right text-ink-soft">
                    {p.overall_score.toFixed(1)}
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-5 space-y-1 text-[0.93rem] text-ink-soft leading-[1.7]">
            {bestLlm.response_id > 0 && (
              <p>
                {deltaVsBestLlm >= 0 ? (
                  <>You beat the strongest LLM on this scenario by{' '}
                    <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
                      {deltaVsBestLlm.toFixed(1)}
                    </span>{' '}points.</>
                ) : (
                  <>The strongest LLM scored{' '}
                    <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
                      {Math.abs(deltaVsBestLlm).toFixed(1)}
                    </span>{' '}higher.</>
                )}
              </p>
            )}
            {poolSize > 1 && (
              <p>
                Among <strong className="text-ink-deep">{poolSize}</strong> human contributor{poolSize === 1 ? '' : 's'},
                you rank <strong className="text-ink-deep">#{myRank}</strong> ({percentile}th percentile).
              </p>
            )}
          </div>
        </section>

        {isHuman && <LiftChart responseId={responseId} yourScore={myScore} />}

        {isHuman && !isPublic && (
          <section className="border-y border-accent bg-accent-wash -mx-8 md:-mx-14 px-8 md:px-14 py-8 my-10">
            <h2
              className="font-display text-ink-deep text-[1.55rem] leading-[1.15] mb-3"
              style={{ fontVariationSettings: '"SOFT" 30, "opsz" 48, "wght" 500' }}
            >
              Contribute this response
            </h2>
            <p className="text-ink-soft text-[0.95rem] leading-[1.7] max-w-[40rem] mb-5">
              Your response currently lives only on this page. If you contribute, it joins the
              public corpus under anonymous attribution — available for research and downstream
              training.
            </p>
            <ContributeButton responseId={responseId} />
          </section>
        )}

        {isHuman && isPublic && (
          <section className="border-y border-rule py-6 my-10">
            <h2 className="font-display text-ink-deep text-[1.4rem] mb-2" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 32, "wght" 500' }}>
              You&apos;re in the corpus
            </h2>
            <p className="text-ink-soft leading-[1.65] text-[0.95rem]">
              <strong className="text-ink-deep">{contributedCount}</strong> public contribution{contributedCount === 1 ? '' : 's'} on this scenario.
              {contributedMean !== null && (
                <> Contributor mean: <strong className="text-ink-deep">{contributedMean.toFixed(1)}</strong>.</>
              )}{' '}
              <Link href="/dataset" className="link">Browse the corpus →</Link>
            </p>
          </section>
        )}

        <section className="border-b border-rule py-10">
          <h2
            className="font-display text-ink-deep text-[1.55rem] leading-[1.15] mb-2"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 48, "wght" 500' }}
          >
            Rubric breakdown
          </h2>
          <p className="text-ink-faint text-[0.88rem] leading-[1.65] mb-6">
            Dominant criteria (bold) count twice in the overall.
          </p>

          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="tag mb-4">Positive · reward</p>
              <div className="space-y-3">
                {Object.entries(positive).map(([label, score]) => {
                  const isDom = dominantSet.has(label.toLowerCase());
                  return (
                    <div key={label} className="grid grid-cols-[1fr_auto_100px] gap-3 items-center">
                      <div className={`text-[0.88rem] leading-snug ${isDom ? 'font-display text-ink-deep' : 'text-ink-soft'}`} style={isDom ? { fontVariationSettings: '"SOFT" 30, "wght" 620' } : undefined}>
                        {label}
                      </div>
                      <div className="font-mono text-xs tabular-nums text-ink-faint w-8 text-right">{score}</div>
                      <SmallBar score={score} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="tag mb-4">Negative · penalty</p>
              <div className="space-y-3">
                {Object.entries(negative).map(([label, score]) => {
                  const isDom = dominantSet.has(label.toLowerCase());
                  return (
                    <div key={label} className="grid grid-cols-[1fr_auto_100px] gap-3 items-center">
                      <div className={`text-[0.88rem] leading-snug ${isDom ? 'font-display text-ink-deep' : 'text-ink-soft'}`} style={isDom ? { fontVariationSettings: '"SOFT" 30, "wght" 620' } : undefined}>
                        {label}
                      </div>
                      <div className="font-mono text-xs tabular-nums text-ink-faint w-8 text-right">{score}</div>
                      <SmallBar score={score} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 border-b border-rule">
          <h2 className="font-display text-ink-deep text-[1.3rem] mb-4" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 32, "wght" 520' }}>
            Your response
          </h2>
          <div className="border border-rule-soft bg-paper-raised px-6 py-5">
            <pre className="whitespace-pre-wrap font-display text-[1rem] leading-[1.7] text-ink-deep" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 16, "wght" 400' }}>
              {response.text}
            </pre>
          </div>
        </section>

        <section className="py-10 border-b border-rule">
          <h2 className="font-display text-ink-deep text-[1.3rem] mb-3" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 32, "wght" 520' }}>
            The scenario
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {md.subcategory && <span className="tag px-2 py-0.5 border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
            {md.medium && <span className="tag px-2 py-0.5 border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
          </div>
          <div className="border-l-2 border-rule pl-5">
            <pre className="whitespace-pre-wrap text-[0.93rem] leading-[1.7] text-ink-soft font-display italic" style={{ fontVariationSettings: '"SOFT" 30, "wght" 420' }}>
              {scenario?.prompt}
            </pre>
          </div>
        </section>

        <footer className="flex flex-wrap gap-3 pt-8">
          <Link href={`/try/${response.scenario_id}`} className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 450' }}>
            Retry this scenario
          </Link>
          <Link href="/try" className="px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 500' }}>
            Try another
          </Link>
        </footer>
      </div>
    </main>
  );
}
