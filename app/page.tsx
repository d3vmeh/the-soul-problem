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
  return { scenarios: scenarios ?? 0, contributions: contributions ?? 0, meanScore: mean };
}

export default async function LandingPage() {
  const stats = await loadStats();

  return (
    <main className="min-h-screen fade-in">
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-14 border-b border-line">
          <Link href="/" className="font-semibold text-[0.95rem] tracking-tight">
            The Soul Problem
          </Link>
          <nav className="flex gap-5 text-[0.88rem] text-muted">
            <Link href="/try" className="hover:text-text">Contribute</Link>
            <Link href="/leaderboard" className="hover:text-text">Leaderboard</Link>
            <Link href="/dataset" className="hover:text-text">Dataset</Link>
            <Link href="/dataset/export" className="hover:text-text">Download</Link>
          </nav>
        </header>

        <section className="mb-16">
          <h1 className="text-[2.6rem] md:text-[3rem] font-semibold tracking-tight leading-[1.05] mb-5">
            A dataset for the messages AI gets wrong.
          </h1>
          <p className="text-[1.05rem] text-muted leading-[1.55] max-w-2xl mb-7">
            Voicemails after a death. Scripts for a layoff. Cards for a miscarriage. Write your
            version. We score it against a rubric built for that exact moment. The best responses
            become training data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/try" className="btn btn-primary">Write a response</Link>
            <Link href="/leaderboard" className="btn btn-secondary">See the leaderboard</Link>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3 mb-16">
          <StatCard label="Scenarios" value={stats.scenarios} />
          <StatCard label="Contributions" value={stats.contributions} />
          <StatCard
            label="Human mean"
            value={stats.meanScore !== null ? stats.meanScore.toFixed(1) : '—'}
            suffix="/ 100"
          />
        </section>

        <section className="mb-16">
          <h2 className="text-[1.4rem] font-semibold tracking-tight mb-6">How it works</h2>
          <ol className="space-y-4">
            {[
              ['Pick a scenario.', 'A specific hard message someone needs to write — a voicemail, script, or letter.'],
              ['Write your version.', 'Short is fine. Your voice, not a model\'s.'],
              ['Get scored.', 'Claude applies the scenario\'s own rubric and returns a 0–100 score plus a per-criterion breakdown.'],
              ['See where you stand.', 'Compared to four frontier LLMs and every human contributor so far.'],
              ['Optionally contribute.', 'Your response joins the public corpus, anonymously.'],
            ].map(([title, body], i) => (
              <li key={i} className="flex gap-4">
                <span className="font-mono text-sm text-muted w-5 shrink-0 pt-0.5">{i + 1}.</span>
                <div>
                  <h3 className="font-medium text-text mb-0.5">{title}</h3>
                  <p className="text-muted text-[0.92rem] leading-[1.55]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-12">
          <h2 className="text-[1.4rem] font-semibold tracking-tight mb-4">Why it matters</h2>
          <p className="text-muted leading-[1.65] mb-3">
            Most instruction-tuning data teaches AI to be helpful, cheerful, and polite. The hardest
            messages people ever write — eulogies, apologies, last words — are none of those things.
            They&apos;re restrained, specific, and often painful.
          </p>
          <p className="text-muted leading-[1.65]">
            A corpus of graded human responses to those exact moments is what&apos;s missing. This
            is that corpus.
          </p>
        </section>

        <footer className="pt-8 border-t border-line text-[0.85rem] text-faint flex flex-wrap gap-2 justify-between">
          <span>A hackathon project on emotional intelligence in language models.</span>
          <span>Apr 2026</span>
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="bg-surface border border-line-subtle rounded-lg p-5">
      <div className="text-[0.78rem] text-faint mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[1.75rem] font-semibold tracking-tight tabular-nums">{value}</span>
        {suffix && <span className="text-xs text-faint">{suffix}</span>}
      </div>
    </div>
  );
}
