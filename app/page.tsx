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
    <main className="min-h-screen page-fade">
      <div className="max-w-[60rem] mx-auto px-8 md:px-14 pt-12 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-16 hairline">
          <Link href="/" className="font-display text-ink-deep text-[1.1rem]" style={{ fontVariationSettings: '"SOFT" 30, "wght" 600' }}>
            The Soul Problem
          </Link>
          <nav className="flex gap-6 text-[0.92rem] text-ink-soft">
            <Link href="/try" className="hover:text-ink transition">Contribute</Link>
            <Link href="/leaderboard" className="hover:text-ink transition">Leaderboard</Link>
            <Link href="/dataset" className="hover:text-ink transition">Corpus</Link>
            <Link href="/dataset/export" className="hover:text-ink transition">Download</Link>
          </nav>
        </header>

        <section className="max-w-[44rem] mb-20">
          <h1
            className="font-display text-ink-deep text-[2.75rem] md:text-[3.6rem] leading-[1.02] mb-7"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 400' }}
          >
            A dataset for the messages{' '}
            <em className="italic">AI gets wrong.</em>
          </h1>
          <p className="text-[1.1rem] leading-[1.6] text-ink-soft mb-8">
            Voicemails after a death. Scripts for a layoff you didn&apos;t choose. Cards for a
            miscarriage. Write your version. We&apos;ll score it against a rubric made for this exact
            moment. The best responses become training data.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/try"
              className="inline-block px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display"
              style={{ fontVariationSettings: '"SOFT" 30, "wght" 500' }}
            >
              Write a response
            </Link>
            <Link
              href="/leaderboard"
              className="inline-block px-6 py-3 border border-rule hover:border-ink text-ink transition font-display"
              style={{ fontVariationSettings: '"SOFT" 30, "wght" 450' }}
            >
              Leaderboard
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-3 border-y border-rule mb-20">
          <StatCell label="Scenarios" value={stats.scenarios} />
          <StatCell label="Contributions" value={stats.contributions} middle />
          <StatCell
            label="Human mean"
            value={stats.meanScore !== null ? stats.meanScore.toFixed(1) : '—'}
            suffix="/ 100"
          />
        </section>

        <section className="max-w-[46rem] mb-20">
          <h2
            className="font-display text-ink-deep text-[1.9rem] leading-[1.15] mb-8"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 48, "wght" 500' }}
          >
            How it works
          </h2>
          <ol className="space-y-5">
            {[
              ['1', 'Pick a scenario.', 'A specific hard message someone needs to write — a voicemail, a script, a letter.'],
              ['2', 'Write your version.', 'Short is fine. Your voice, not a model\'s.'],
              ['3', 'Get scored.', 'Claude applies the scenario\'s own rubric and returns a 0–100 overall with a full per-criterion breakdown.'],
              ['4', 'See where you stand.', 'Compared to four frontier LLMs and every human contributor before you.'],
              ['5', 'Optionally contribute.', 'Your response joins the public corpus, anonymously. Training data that didn\'t exist yesterday.'],
            ].map(([n, title, body]) => (
              <li key={n} className="flex gap-5">
                <span className="font-mono text-sm tabular-nums text-accent shrink-0 w-6 pt-1">{n}</span>
                <div>
                  <h3
                    className="font-display text-[1.15rem] text-ink-deep mb-1"
                    style={{ fontVariationSettings: '"SOFT" 30, "opsz" 24, "wght" 550' }}
                  >
                    {title}
                  </h3>
                  <p className="text-ink-soft text-[0.98rem] leading-[1.65]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="max-w-[46rem] mb-16">
          <h2
            className="font-display text-ink-deep text-[1.9rem] leading-[1.15] mb-4"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 48, "wght" 500' }}
          >
            Why it matters
          </h2>
          <p className="text-ink-soft leading-[1.7] mb-3">
            Most instruction-tuning data teaches AI to be helpful, cheerful, polite. The hardest
            messages people ever write — eulogies, apologies, last words — are none of those things.
            They&apos;re restrained, specific, and often painful.
          </p>
          <p className="text-ink-soft leading-[1.7]">
            A corpus of graded human responses to those exact moments is what&apos;s missing. This is
            that corpus.
          </p>
        </section>

        <footer className="pt-8 border-t border-rule text-[0.88rem] text-ink-faint flex flex-wrap gap-2 justify-between">
          <span>A hackathon project on emotional intelligence in language models.</span>
          <span>Apr 2026</span>
        </footer>
      </div>
    </main>
  );
}

function StatCell({
  label,
  value,
  suffix,
  middle,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  middle?: boolean;
}) {
  return (
    <div className={`px-5 py-7 ${middle ? 'border-x border-rule-soft' : ''}`}>
      <div className="tag mb-3">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-display text-ink-deep text-[2.6rem] leading-none tabular-nums"
          style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 380' }}
        >
          {value}
        </span>
        {suffix && <span className="text-ink-faint text-sm">{suffix}</span>}
      </div>
    </div>
  );
}
