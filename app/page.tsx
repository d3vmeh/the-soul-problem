import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export const revalidate = 30;

async function loadStats() {
  const db = supabaseService();
  const [{ count: scenarios }, { count: contributions }, { data: judgments }] = await Promise.all([
    db.from('scenarios').select('*', { count: 'exact', head: true }),
    db.from('responses').select('*', { count: 'exact', head: true }).eq('model', 'human:public'),
    db
      .from('judgments')
      .select('overall_score, responses!inner(model)')
      .eq('responses.model', 'human:public'),
  ]);
  const scores = (judgments ?? []).map((j: any) => j.overall_score).filter((n: number) => Number.isFinite(n));
  const mean = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
  return {
    scenarios: scenarios ?? 0,
    contributions: contributions ?? 0,
    meanScore: mean,
  };
}

export default async function LandingPage() {
  const stats = await loadStats();
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-3xl mx-auto px-6 py-24 space-y-14">
        <header className="space-y-5">
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            The Soul Problem
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold leading-[1.1]">
            A dataset for the messages AI gets wrong.
          </h1>
          <p className="text-lg text-neutral-600 max-w-2xl">
            Voicemails after a suicide. Scripts for a layoff you didn't choose. Cards for a miscarriage.
            LLMs handle these clumsily — they platitude, they euphemize, they center the wrong person.
            Write your version. Claude scores it against a per-scenario rubric. The best responses become
            training data for better models.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/try"
              className="inline-block px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition"
            >
              Write a response
            </Link>
            <Link
              href="/leaderboard"
              className="inline-block px-6 py-3 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition"
            >
              Leaderboard
            </Link>
            <Link
              href="/dataset"
              className="inline-block px-6 py-3 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition"
            >
              Browse the dataset
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Scenarios</div>
            <div className="text-2xl font-semibold">{stats.scenarios}</div>
            <p className="text-neutral-600 mt-1">Each with its own 12+ criteria rubric — not a generic empathy scale.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Human contributions</div>
            <div className="text-2xl font-semibold">{stats.contributions}</div>
            <p className="text-neutral-600 mt-1">
              {stats.contributions === 0 ? 'Be the first.' : 'and growing — every response anonymized.'}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Human mean score</div>
            <div className="text-2xl font-semibold">
              {stats.meanScore !== null ? stats.meanScore.toFixed(1) : '—'}
            </div>
            <p className="text-neutral-600 mt-1">0–100 overall, Sonnet-judged. See how you compare.</p>
          </div>
        </section>

        <section id="how-it-works" className="space-y-4 text-neutral-700">
          <h2 className="text-xl font-semibold text-neutral-900">How it works</h2>
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">1</span>
              <span>Pick a scenario — a specific hard message someone needs to write.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">2</span>
              <span>Write your version. Short is fine.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">3</span>
              <span>
                Claude Sonnet 4.6 scores it against the scenario's own rubric — a dozen positive and
                negative criteria specific to that moment — and returns a 0–100 overall.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">4</span>
              <span>
                See how your score ranks against four frontier LLMs and every other human contributor.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">5</span>
              <span>
                Optionally contribute. The dataset is the point — graded human responses on emotionally
                hard writing are the training signal LLMs don't have enough of.
              </span>
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
          <p className="mb-2"><strong className="text-neutral-900">Why this matters.</strong></p>
          <p>
            Almost every instruction-tuning corpus over-weights helpful, cheerful, polite responses.
            The hardest messages a person ever writes are not helpful, cheerful, or polite —
            they're restrained, specific, and often painful. A corpus of graded human responses on
            those exact moments is what's missing. This is that corpus.
          </p>
        </section>

        <footer className="text-xs text-neutral-400 pt-4 border-t border-neutral-200">
          A hackathon project on emotional intelligence in large language models.
        </footer>
      </div>
    </main>
  );
}
