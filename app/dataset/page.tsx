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
    .select(`
      id,
      prompt,
      metadata,
      responses(
        id,
        model,
        text,
        judgments(overall_score, judge_model)
      )
    `)
    .order('id');

  if (error) {
    return (
      <main className="min-h-screen">
        <div className="max-w-[56rem] mx-auto px-8 md:px-16 pt-16">
          <p className="eyebrow text-accent-deep">Archive unavailable</p>
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
    <main className="min-h-screen">
      <div className="max-w-[64rem] mx-auto px-8 md:px-16 pt-16 pb-24">
        <header className="flex items-baseline justify-between pb-6 mb-16 hairline reveal-in">
          <Link href="/" className="eyebrow hover:text-ink transition">← The Soul Problem</Link>
          <div className="eyebrow">The archive</div>
        </header>

        <section className="mb-16 reveal-up">
          <p className="eyebrow mb-3">The archive</p>
          <h1
            className="font-display text-ink-deep text-[3.5rem] md:text-[4.5rem] leading-[0.95] mb-6"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 320' }}
          >
            Every response,<br />
            <em className="italic text-accent-deep">scored the same way.</em>
          </h1>
          <p className="text-[1.05rem] leading-[1.7] text-ink-soft max-w-[42rem]">
            Contributed human responses alongside every LLM baseline. Grouped by scenario. Sorted by
            score within each. Anonymous.
          </p>
        </section>

        <section className="grid grid-cols-3 border-y border-rule mb-16 reveal-up" style={{ animationDelay: '0.15s' }}>
          <Stat label="Scenarios" value={visible.length} />
          <Stat label="Human contributions" value={totals.humans} middle />
          <Stat label="LLM baselines" value={totals.llms} />
        </section>

        {visible.map((scenario, si) => {
          const md = (scenario.metadata ?? {}) as any;
          const sorted = [...scenario.visibleResponses].sort((a, b) => {
            const sa = a.judgments[0]?.overall_score ?? -1;
            const sb = b.judgments[0]?.overall_score ?? -1;
            return sb - sa;
          });
          return (
            <article
              key={scenario.id}
              className="mb-20 pb-2 border-t border-rule pt-10 reveal-up"
              style={{ animationDelay: `${0.25 + si * 0.05}s` }}
            >
              <p className="eyebrow mb-3">Scenario · {String(scenario.id).padStart(3, '0')}</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {md.subcategory && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
                {md.medium && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
              </div>
              <details className="mb-8 group">
                <summary className="cursor-pointer text-sm text-ink-faint italic font-display hover:text-ink transition list-none" style={{ fontVariationSettings: '"SOFT" 100, "wght" 380' }}>
                  <span className="group-open:hidden">▸ Show prompt</span>
                  <span className="hidden group-open:inline">▾ Hide prompt</span>
                </summary>
                <pre className="mt-4 whitespace-pre-wrap font-display text-[1rem] leading-[1.7] text-ink-soft bg-paper-raised border-l-2 border-accent pl-5 py-3" style={{ fontVariationSettings: '"SOFT" 100, "wght" 400' }}>
                  {scenario.prompt}
                </pre>
              </details>

              <div className="space-y-4">
                {sorted.length === 0 && (
                  <p className="text-sm text-ink-whisper italic font-display">No responses yet.</p>
                )}
                {sorted.map(r => {
                  const score = r.judgments[0]?.overall_score ?? null;
                  const isHuman = r.model === 'human:public';
                  return (
                    <div key={r.id} className={`border p-5 ${isHuman ? 'border-accent bg-accent-wash' : 'border-rule-soft bg-paper-raised'}`}>
                      <header className="flex items-center gap-3 mb-3">
                        <span className={`eyebrow ${isHuman ? 'text-accent-deep' : 'text-ink-faint'}`}>
                          {modelLabel(r.model)}
                        </span>
                        {score !== null ? (
                          <span className="font-mono text-sm tabular-nums text-ink-deep" style={{ fontWeight: 500 }}>
                            {score.toFixed(1)} / 100
                          </span>
                        ) : (
                          <span className="eyebrow text-ink-whisper">no judgment</span>
                        )}
                      </header>
                      <pre className="whitespace-pre-wrap font-display text-[0.97rem] leading-[1.65] text-ink-deep" style={{ fontVariationSettings: '"SOFT" 100, "wght" 400' }}>
                        {r.text}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}

        <footer className="pt-10 mt-12 border-t border-rule flex flex-wrap gap-3">
          <Link href="/try" className="px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display" style={{ fontVariationSettings: '"SOFT" 60, "wght" 450' }}>
            Write a response
          </Link>
          <Link href="/leaderboard" className="px-6 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 80, "wght" 400' }}>
            Leaderboard
          </Link>
          <Link href="/dataset/export" className="px-6 py-3 border border-rule hover:border-ink text-ink transition font-display" style={{ fontVariationSettings: '"SOFT" 80, "wght" 400' }}>
            Download
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value, middle }: { label: string; value: number | string; middle?: boolean }) {
  return (
    <div className={`px-6 py-8 ${middle ? 'border-x border-rule' : ''}`}>
      <div className="eyebrow mb-4">{label}</div>
      <div
        className="font-display text-ink-deep text-[3rem] leading-none tabular-nums"
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 280' }}
      >
        {value}
      </div>
    </div>
  );
}
