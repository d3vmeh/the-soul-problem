import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

function modelLabel(model: string): string {
  if (model === 'human:public') return 'Human';
  if (model === 'claude-opus-4-7') return 'Claude Opus 4.7';
  if (model === 'claude-sonnet-4-6') return 'Claude Sonnet 4.6';
  if (model === 'claude-haiku-4-5') return 'Claude Haiku 4.5';
  if (model === 'claude-opus-blunt') return 'Claude Opus (blunt)';
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model === 'gpt-4o-mini') return 'GPT-4o mini';
  return model;
}

type SbResponse = {
  id: number;
  model: string;
  text: string;
  judgments: { overall_score: number; judge_model: string }[];
};
type SbScenario = {
  id: number;
  prompt: string;
  metadata: Record<string, unknown>;
  responses: SbResponse[];
};

export default async function DatasetPage() {
  const db = supabaseService();
  const { data: scenarios, error } = await db
    .from('scenarios')
    .select(`id, prompt, metadata, responses(id, model, text, judgments(overall_score, judge_model))`)
    .order('id');

  if (error) {
    return (
      <main className="min-h-screen page-fade">
        <div className="max-w-[56rem] mx-auto px-8 md:px-14 pt-16">
          <p className="text-accent-deep">Corpus unavailable.</p>
          <p className="text-ink-soft mt-2">{error.message}</p>
        </div>
      </main>
    );
  }

  const typed = (scenarios ?? []) as SbScenario[];
  const visible = typed.map(s => ({
    ...s,
    visibleResponses: s.responses.filter(
      r => r.model === 'human:public' || r.model.startsWith('claude-') || r.model.startsWith('gpt-')
    ),
  }));

  const totals = visible.reduce(
    (acc, s) => {
      for (const r of s.visibleResponses) {
        if (r.model === 'human:public') acc.humans += 1;
        else acc.llms += 1;
      }
      return acc;
    },
    { humans: 0, llms: 0 }
  );

  return (
    <main className="min-h-screen page-fade">
      <div className="max-w-[60rem] mx-auto px-8 md:px-14 pt-12 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-12 hairline">
          <Link href="/" className="font-display text-ink-deep text-[1.05rem]" style={{ fontVariationSettings: '"SOFT" 30, "wght" 600' }}>
            ← The Soul Problem
          </Link>
          <div className="text-[0.92rem] text-ink-soft">Corpus</div>
        </header>

        <section className="max-w-[44rem] mb-12">
          <h1
            className="font-display text-ink-deep text-[2.4rem] md:text-[2.9rem] leading-[1.05] mb-5"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 420' }}
          >
            The corpus in full.
          </h1>
          <p className="text-ink-soft text-[1.02rem] leading-[1.65]">
            Every public contribution and every LLM baseline, grouped by scenario, sorted by score
            within each. Human responses highlighted. All anonymous.
          </p>
        </section>

        <section className="grid grid-cols-3 border-y border-rule mb-12">
          <Stat label="Scenarios" value={visible.length} />
          <Stat label="Human contributions" value={totals.humans} middle />
          <Stat label="LLM baselines" value={totals.llms} />
        </section>

        {visible.map((scenario) => {
          const md = (scenario.metadata ?? {}) as any;
          const sorted = [...scenario.visibleResponses].sort((a, b) => {
            const sa = a.judgments[0]?.overall_score ?? -1;
            const sb = b.judgments[0]?.overall_score ?? -1;
            return sb - sa;
          });
          return (
            <article
              key={scenario.id}
              className="mb-14 border-t border-rule pt-8"
            >
              <div className="flex items-baseline gap-3 mb-4 flex-wrap">
                <h2
                  className="font-display text-ink-deep text-[1.3rem]"
                  style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 550' }}
                >
                  Scenario {String(scenario.id).padStart(3, '0')}
                </h2>
                {md.subcategory && <span className="tag px-2 py-0.5 border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
                {md.medium && <span className="tag px-2 py-0.5 border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
              </div>
              <details className="mb-5 group">
                <summary className="cursor-pointer text-[0.88rem] text-ink-faint italic font-display hover:text-ink transition list-none" style={{ fontVariationSettings: '"SOFT" 30, "wght" 420' }}>
                  <span className="group-open:hidden">▸ Show prompt text</span>
                  <span className="hidden group-open:inline">▾ Hide prompt text</span>
                </summary>
                <div className="mt-3 border-l-2 border-rule pl-4 py-1">
                  <pre className="whitespace-pre-wrap font-display text-[0.95rem] leading-[1.7] text-ink-soft italic" style={{ fontVariationSettings: '"SOFT" 30, "wght" 420' }}>
                    {scenario.prompt}
                  </pre>
                </div>
              </details>

              <div className="space-y-3">
                {sorted.length === 0 && (
                  <p className="text-sm text-ink-faint italic font-display">No responses yet.</p>
                )}
                {sorted.map(r => {
                  const score = r.judgments[0]?.overall_score ?? null;
                  const isHuman = r.model === 'human:public';
                  return (
                    <div key={r.id} className={`border px-5 py-4 ${isHuman ? 'border-accent bg-accent-wash' : 'border-rule-soft bg-paper-raised'}`}>
                      <header className="flex items-center gap-3 mb-3 pb-3 border-b border-rule-hair">
                        <span className={`tag ${isHuman ? 'text-accent' : 'text-ink-faint'}`}>
                          {modelLabel(r.model)}
                        </span>
                        {score !== null ? (
                          <span className="font-mono text-xs tabular-nums text-ink-deep" style={{ fontWeight: 500 }}>
                            {score.toFixed(1)} / 100
                          </span>
                        ) : (
                          <span className="text-xs text-ink-faint">no judgment</span>
                        )}
                      </header>
                      <pre className="whitespace-pre-wrap font-display text-[0.93rem] leading-[1.65] text-ink-deep" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 16, "wght" 400' }}>
                        {r.text}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}

        <footer className="pt-10 mt-6 border-t border-rule flex flex-wrap gap-3">
          <Link href="/try" className="px-5 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 500' }}>
            Contribute
          </Link>
          <Link href="/leaderboard" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 450' }}>
            Leaderboard
          </Link>
          <Link href="/dataset/export" className="px-5 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 30, "wght" 450' }}>
            Download
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value, middle }: { label: string; value: number | string; middle?: boolean }) {
  return (
    <div className={`px-5 py-7 ${middle ? 'border-x border-rule-soft' : ''}`}>
      <div className="tag mb-3">{label}</div>
      <div
        className="font-display text-ink-deep text-[2.5rem] leading-none tabular-nums"
        style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 380' }}
      >
        {value}
      </div>
    </div>
  );
}
