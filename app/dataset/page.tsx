import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

function modelLabel(model: string): string {
  if (model === 'human:public') return 'Human';
  if (model === 'claude-opus-4-7') return 'Claude Opus 4.7';
  if (model === 'claude-sonnet-4-6') return 'Claude Sonnet 4.6';
  if (model === 'claude-haiku-4-5') return 'Claude Haiku 4.5';
  if (model === 'claude-opus-blunt') return 'Claude Opus (blunt)';
  return model;
}

function scoreColor(n: number): string {
  if (n >= 85) return 'bg-emerald-100 text-emerald-900';
  if (n >= 70) return 'bg-blue-100 text-blue-900';
  if (n >= 50) return 'bg-amber-100 text-amber-900';
  return 'bg-rose-100 text-rose-900';
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
      <main className="min-h-screen bg-white text-neutral-900">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-2xl font-semibold">Couldn't load dataset</h1>
          <p className="text-sm text-neutral-600 mt-2">{error.message}</p>
        </div>
      </main>
    );
  }

  const typed = (scenarios ?? []) as SbScenario[];

  // Only include responses that are public (humans) or LLM-generated (all claude-*).
  const visible = typed.map(s => ({
    ...s,
    visibleResponses: s.responses.filter(
      r => r.model === 'human:public' || r.model.startsWith('claude-')
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
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <header className="space-y-3">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-700">
            ← home
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            The dataset
          </h1>
          <p className="text-neutral-600 max-w-2xl">
            Every contributed human response, every LLM baseline. Scored against the same rubric. Grouped by
            scenario. All anonymous.
          </p>
        </header>

        <section className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Scenarios</div>
            <div className="text-2xl font-semibold">{visible.length}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Human contributions</div>
            <div className="text-2xl font-semibold">{totals.humans}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">LLM baselines</div>
            <div className="text-2xl font-semibold">{totals.llms}</div>
          </div>
        </section>

        {visible.map(scenario => {
          const md = (scenario.metadata ?? {}) as any;
          const sorted = [...scenario.visibleResponses].sort((a, b) => {
            const sa = a.judgments[0]?.overall_score ?? -1;
            const sb = b.judgments[0]?.overall_score ?? -1;
            return sb - sa;
          });
          return (
            <section key={scenario.id} className="space-y-4 border-t border-neutral-200 pt-8">
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wider text-neutral-500">
                <span>Scenario {scenario.id}</span>
                {md.subcategory && <><span>·</span><span>{String(md.subcategory).replace(/_/g, ' ')}</span></>}
                {md.medium && <><span>·</span><span>{String(md.medium).replace(/_/g, ' ')}</span></>}
              </div>
              <details className="group">
                <summary className="cursor-pointer text-sm text-neutral-700 hover:text-neutral-900">
                  Show scenario prompt
                </summary>
                <pre className="mt-3 whitespace-pre-wrap bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-800 font-sans">
                  {scenario.prompt}
                </pre>
              </details>

              <div className="space-y-3">
                {sorted.length === 0 && (
                  <p className="text-sm text-neutral-500 italic">No responses yet.</p>
                )}
                {sorted.map(r => {
                  const score = r.judgments[0]?.overall_score ?? null;
                  const isHuman = r.model === 'human:public';
                  return (
                    <article key={r.id} className="rounded-lg border border-neutral-200 p-4 space-y-2">
                      <header className="flex items-center gap-2 text-xs">
                        <span className={`rounded px-2 py-0.5 font-medium ${isHuman ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                          {modelLabel(r.model)}
                        </span>
                        {score !== null && (
                          <span className={`rounded px-2 py-0.5 font-medium tabular-nums ${scoreColor(score)}`}>
                            {score.toFixed(1)}
                          </span>
                        )}
                        {score === null && (
                          <span className="text-neutral-500">no judgment yet</span>
                        )}
                      </header>
                      <pre className="whitespace-pre-wrap text-sm text-neutral-800 font-sans">{r.text}</pre>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <footer className="pt-6 border-t border-neutral-200 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Link href="/try" className="inline-block px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm">
              Write a response
            </Link>
            <Link href="/leaderboard" className="inline-block px-4 py-2 rounded-lg border border-neutral-300 text-sm">
              Leaderboard
            </Link>
            <Link href="/dataset/export" className="inline-block px-4 py-2 rounded-lg border border-neutral-300 text-sm">
              Download the dataset
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
