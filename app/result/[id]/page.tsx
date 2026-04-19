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
    <div className="relative flex-1 h-8 bg-paper-warm rounded-none border border-rule-soft overflow-hidden">
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
    <div className="relative w-20 h-1.5 bg-paper-warm rounded-none overflow-hidden">
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
      <main className="min-h-screen">
        <div className="max-w-[56rem] mx-auto px-8 md:px-16 pt-16 pb-24">
          <header className="flex items-baseline justify-between pb-6 mb-16 hairline">
            <Link href="/" className="eyebrow hover:text-ink transition">← The Soul Problem</Link>
            <div className="eyebrow">Submission saved</div>
          </header>
          <h1 className="font-display text-ink-deep text-[3rem] leading-[1] mb-6" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 340' }}>
            Your response was saved.
          </h1>
          <p className="text-ink-soft mb-8 leading-[1.7]">The judge did not return a score this time. You can try again.</p>
          <Link href={`/try/${response.scenario_id}`} className="inline-block px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition">
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
    <main className="min-h-screen">
      <div className="max-w-[56rem] mx-auto px-8 md:px-16 pt-16 pb-24">
        <header className="flex items-baseline justify-between pb-6 mb-16 hairline reveal-in">
          <Link href="/try" className="eyebrow hover:text-ink transition">← Scenarios</Link>
          <div className="eyebrow">
            {isHuman ? (isPublic ? 'Contributed · public' : 'Your draft · private') : 'Model baseline'}
          </div>
        </header>

        {/* The Number */}
        <section className="mb-20 reveal-up">
          <p className="eyebrow mb-3">Overall item score</p>
          <div className="flex items-baseline gap-6">
            <div
              className="font-display text-ink-deep text-[9rem] md:text-[12rem] leading-[0.9] tabular-nums"
              style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 280' }}
            >
              {myScore.toFixed(1)}
            </div>
            <div className="flex flex-col gap-1 pb-4">
              <span className="eyebrow">/ 100</span>
              <span
                className="font-display text-[1.5rem] text-accent-deep italic"
                style={{ fontVariationSettings: '"SOFT" 100, "opsz" 48, "wght" 380' }}
              >
                {band(myScore)}
              </span>
            </div>
          </div>
          <p className="text-[1.05rem] leading-[1.7] text-ink-soft mt-8 max-w-[42rem] italic font-display" style={{ fontVariationSettings: '"SOFT" 100, "wght" 380' }}>
            &ldquo;{judgment.rationale}&rdquo;
          </p>
          <p className="eyebrow mt-4">— {judgment.judge_model}</p>
        </section>

        {/* Rankings */}
        <section className="border-y border-rule py-10 mb-0">
          <p className="eyebrow mb-3">The field</p>
          <h2
            className="font-display text-ink-deep text-[2rem] leading-[1.05] mb-6"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 360' }}
          >
            Where you stand,<br />
            <em className="italic">on this scenario.</em>
          </h2>

          <div className="space-y-0 divide-y divide-rule-soft">
            <div className="grid grid-cols-[1fr_240px_60px] gap-4 items-center py-3">
              <div
                className="font-display text-[1.2rem] text-ink-deep"
                style={{ fontVariationSettings: '"SOFT" 70, "opsz" 48, "wght" 520' }}
              >
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
                <div key={p.response_id} className="grid grid-cols-[1fr_240px_60px] gap-4 items-center py-3">
                  <div className="text-[0.95rem] text-ink-soft">{modelDisplay(p.model)}</div>
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
                <div key={p.response_id} className="grid grid-cols-[1fr_240px_60px] gap-4 items-center py-3">
                  <div className="text-[0.95rem] text-ink-soft italic font-display">Human #{i + 1}</div>
                  <Bar score={p.overall_score} />
                  <div className="font-mono text-sm tabular-nums text-right text-ink-soft">
                    {p.overall_score.toFixed(1)}
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-6 space-y-1 text-ink-soft leading-[1.65] text-[0.95rem]">
            {bestLlm.response_id > 0 && (
              <p>
                {deltaVsBestLlm >= 0 ? (
                  <>You beat the strongest LLM on this scenario by{' '}
                  <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
                    {deltaVsBestLlm.toFixed(1)}
                  </span> points.</>
                ) : (
                  <>The strongest LLM scored{' '}
                  <span className="font-mono text-accent-deep tabular-nums" style={{ fontWeight: 600 }}>
                    {Math.abs(deltaVsBestLlm).toFixed(1)}
                  </span> higher.</>
                )}
              </p>
            )}
            {poolSize > 1 && (
              <p>
                Among <strong className="text-ink-deep">{poolSize}</strong> human contributor{poolSize === 1 ? '' : 's'},
                your response ranks <strong className="text-ink-deep">#{myRank}</strong> ({percentile}th percentile).
              </p>
            )}
          </div>
        </section>

        {/* Lift experiment */}
        {isHuman && <LiftChart responseId={responseId} yourScore={myScore} />}

        {/* Contribute / public state */}
        {isHuman && !isPublic && (
          <section className="border-y border-accent-wash bg-accent-wash -mx-8 md:-mx-16 px-8 md:px-16 py-10 my-10">
            <p className="eyebrow text-accent-deep mb-3">An invitation</p>
            <h2
              className="font-display text-ink-deep text-[1.85rem] leading-[1.1] mb-4"
              style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 360' }}
            >
              Contribute this response<br />
              <em className="italic text-accent-deep">to the public archive.</em>
            </h2>
            <p className="text-ink-soft leading-[1.7] max-w-[38rem] mb-6">
              Your response currently lives only on this page. If you contribute, it joins the
              public dataset — rubric-graded, anonymized, downloadable. One more signal.
            </p>
            <ContributeButton responseId={responseId} />
          </section>
        )}

        {isHuman && isPublic && (
          <section className="border-y border-rule py-8 my-10">
            <p className="eyebrow mb-2">In the archive</p>
            <p className="text-ink-soft leading-[1.7]">
              There {contributedCount === 1 ? 'is' : 'are'} now{' '}
              <strong className="text-ink-deep">{contributedCount}</strong> public contribution
              {contributedCount === 1 ? '' : 's'} on this scenario.
              {contributedMean !== null && (
                <> Contributor mean: <strong className="text-ink-deep">{contributedMean.toFixed(1)}</strong>.</>
              )}{' '}
              <Link href="/dataset" className="text-accent-deep underline underline-offset-2">
                Browse the archive →
              </Link>
            </p>
          </section>
        )}

        {/* Criteria breakdown */}
        <section className="border-b border-rule py-10">
          <p className="eyebrow mb-3">The rubric</p>
          <h2
            className="font-display text-ink-deep text-[1.85rem] leading-[1.1] mb-6"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 360' }}
          >
            Every criterion,<br /><em className="italic">one to ten.</em>
          </h2>
          <p className="text-ink-faint text-sm leading-[1.65] mb-6">
            Dominant criteria (set in bold) count double in the overall score.
          </p>

          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="eyebrow mb-4">Positive · reward</p>
              <div className="space-y-3">
                {Object.entries(positive).map(([label, score]) => {
                  const isDom = dominantSet.has(label.toLowerCase());
                  return (
                    <div key={label} className="grid grid-cols-[1fr_auto_80px] gap-3 items-center">
                      <div className={`text-sm leading-snug ${isDom ? 'font-display font-semibold text-ink-deep' : 'text-ink-soft'}`} style={isDom ? { fontVariationSettings: '"SOFT" 70, "wght" 550' } : undefined}>
                        {label}
                      </div>
                      <div className="font-mono text-xs tabular-nums text-ink-whisper">{score}/10</div>
                      <SmallBar score={score} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-4">Negative · penalize</p>
              <div className="space-y-3">
                {Object.entries(negative).map(([label, score]) => {
                  const isDom = dominantSet.has(label.toLowerCase());
                  return (
                    <div key={label} className="grid grid-cols-[1fr_auto_80px] gap-3 items-center">
                      <div className={`text-sm leading-snug ${isDom ? 'font-display font-semibold text-ink-deep' : 'text-ink-soft'}`} style={isDom ? { fontVariationSettings: '"SOFT" 70, "wght" 550' } : undefined}>
                        {label}
                      </div>
                      <div className="font-mono text-xs tabular-nums text-ink-whisper">{score}/10</div>
                      <SmallBar score={score} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* The response + scenario */}
        <section className="py-10 border-b border-rule">
          <p className="eyebrow mb-3">Your words</p>
          <pre className="whitespace-pre-wrap font-display text-[1.1rem] leading-[1.65] text-ink-deep bg-paper-raised border border-rule-soft p-7" style={{ fontVariationSettings: '"SOFT" 100, "wght" 400' }}>
            {response.text}
          </pre>
        </section>

        <section className="py-10 border-b border-rule">
          <p className="eyebrow mb-3">The scenario</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {md.subcategory && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
            {md.medium && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
          </div>
          <pre className="whitespace-pre-wrap text-[0.95rem] leading-[1.65] text-ink-soft font-display italic" style={{ fontVariationSettings: '"SOFT" 100, "wght" 380' }}>
            {scenario?.prompt}
          </pre>
        </section>

        <footer className="flex flex-wrap gap-3 pt-8">
          <Link href={`/try/${response.scenario_id}`} className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 80, "wght" 420' }}>
            Try this scenario again
          </Link>
          <Link href="/try" className="px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 60, "wght" 450' }}>
            Try another scenario
          </Link>
        </footer>
      </div>
    </main>
  );
}
