import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function modelLabel(model: string): string {
  if (model === 'human:public') return 'Human';
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

type SbResponse = { id: number; model: string; text: string; judgments: { overall_score: number }[] };
type SbScenario = { id: number; prompt: string; metadata: Record<string, unknown>; responses: SbResponse[] };

export default async function DatasetPage() {
  const db = supabaseService();
  const { data: scenarios, error } = await db
    .from('scenarios')
    .select(`id, prompt, metadata, responses(id, model, text, judgments(overall_score))`)
    .order('id');

  if (error) {
    return (
      <main className="min-h-screen fade-in">
        <div className="max-w-3xl mx-auto px-6 pt-10">
          <p className="text-red-700">Corpus unavailable. {error.message}</p>
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
    <main className="min-h-screen fade-in">
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-10 border-b border-line">
          <Link href="/" className="font-semibold tracking-tight text-[0.95rem]">← The Soul Problem</Link>
          <div className="text-[0.85rem] text-muted">Dataset</div>
        </header>

        <section className="mb-10">
          <h1 className="text-[2rem] font-semibold tracking-tight leading-[1.1] mb-3">The corpus in full.</h1>
          <p className="text-muted leading-[1.55] max-w-2xl">
            Every public contribution and LLM baseline, grouped by scenario, sorted by score. Human
            responses highlighted.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-3 mb-10">
          <Stat label="Scenarios" value={visible.length} />
          <Stat label="Human contributions" value={totals.humans} />
          <Stat label="LLM baselines" value={totals.llms} />
        </section>

        {visible.map(scenario => {
          const md = (scenario.metadata ?? {}) as any;
          const meta = [md.subcategory, md.medium].filter(Boolean).map(s => String(s).replace(/_/g, ' ')).join(' · ');
          const sorted = [...scenario.visibleResponses].sort((a, b) => {
            const sa = a.judgments[0]?.overall_score ?? -1;
            const sb = b.judgments[0]?.overall_score ?? -1;
            return sb - sa;
          });
          return (
            <article key={scenario.id} className="mb-10 rounded-lg border border-line bg-bg overflow-hidden">
              <header className="px-5 py-4 border-b border-line-subtle bg-surface flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-[0.95rem] font-semibold">Scenario {String(scenario.id).padStart(3, '0')}</h2>
                  {meta && <p className="text-[0.78rem] text-faint mt-0.5">{meta}</p>}
                </div>
                <details className="text-[0.82rem] text-muted">
                  <summary className="cursor-pointer hover:text-text list-none">
                    <span className="group-open:hidden">▸ prompt</span>
                  </summary>
                  <pre className="whitespace-pre-wrap text-[0.85rem] leading-[1.6] text-muted mt-3 font-sans max-w-3xl">
                    {scenario.prompt}
                  </pre>
                </details>
              </header>
              <div className="divide-y divide-line-subtle">
                {sorted.length === 0 && (
                  <p className="px-5 py-4 text-sm text-faint italic">No responses yet.</p>
                )}
                {sorted.map(r => {
                  const score = r.judgments[0]?.overall_score ?? null;
                  const isHuman = r.model === 'human:public';
                  return (
                    <div key={r.id} className={`px-5 py-4 ${isHuman ? 'bg-accent-tint' : ''}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-[0.82rem] font-medium ${isHuman ? 'text-accent' : 'text-muted'}`}>
                          {modelLabel(r.model)}
                        </span>
                        {score !== null ? (
                          <span className="font-mono text-xs tabular-nums text-muted font-medium">
                            {score.toFixed(1)} / 100
                          </span>
                        ) : (
                          <span className="text-xs text-faint">no judgment</span>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap text-[0.9rem] leading-[1.55] text-text font-sans">
                        {r.text}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}

        <footer className="pt-8 border-t border-line-subtle flex flex-wrap gap-2">
          <Link href="/try" className="btn btn-primary">Contribute</Link>
          <Link href="/leaderboard" className="btn btn-secondary">Leaderboard</Link>
          <Link href="/dataset/export" className="btn btn-secondary">Download</Link>
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-surface border border-line-subtle rounded-lg p-4">
      <div className="text-[0.78rem] text-faint mb-2">{label}</div>
      <div className="text-[1.75rem] font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}
