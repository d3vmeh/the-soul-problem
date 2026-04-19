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
    <main className="min-h-screen">
      <div className="max-w-[68rem] mx-auto px-8 md:px-16 pt-16 md:pt-24 pb-24">
        {/* Masthead */}
        <header className="flex items-baseline justify-between pb-6 mb-20 hairline reveal-in">
          <div className="eyebrow">The Soul Problem · vol. I</div>
          <nav className="eyebrow flex gap-6">
            <Link href="/try" className="hover:text-ink transition">Contribute</Link>
            <Link href="/leaderboard" className="hover:text-ink transition">Leaderboard</Link>
            <Link href="/dataset" className="hover:text-ink transition">Archive</Link>
            <Link href="/dataset/export" className="hover:text-ink transition">Download</Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid md:grid-cols-12 gap-12 items-start mb-24">
          <div className="md:col-span-8 space-y-8 reveal-up" style={{ animationDelay: '0.05s' }}>
            <p className="eyebrow">A dataset of hard things to write</p>
            <h1
              className="font-display text-ink-deep leading-[0.92] text-[3.5rem] md:text-[5.5rem] font-light"
              style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 320' }}
            >
              A voicemail,<br />
              <em className="italic text-accent-deep" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 380' }}>
                three weeks
              </em>
              <br />
              after a suicide.
            </h1>
            <p className="text-[1.125rem] leading-[1.65] text-ink-soft max-w-[36rem]">
              This is a corpus of messages large language models get wrong — not through lack of
              fluency but through lack of restraint. Every scenario carries its own rubric,
              authored before any model saw it. Write what you think the ideal response would be.
              We'll score it. The best become training data.
            </p>
            <div className="flex flex-wrap gap-3 pt-4">
              <Link
                href="/try"
                className="group inline-flex items-center gap-3 px-7 py-4 bg-ink text-paper-raised hover:bg-accent-deep transition"
              >
                <span className="eyebrow text-paper-raised opacity-80">01 →</span>
                <span className="font-display text-lg" style={{ fontVariationSettings: '"SOFT" 60, "wght" 450' }}>Write a response</span>
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center px-7 py-4 border border-rule hover:border-ink text-ink transition"
              >
                <span className="font-display text-lg" style={{ fontVariationSettings: '"SOFT" 80, "wght" 400' }}>See the standings</span>
              </Link>
            </div>
          </div>

          {/* Aside — epigraph */}
          <aside className="md:col-span-4 md:pt-24 reveal-up" style={{ animationDelay: '0.35s' }}>
            <div className="border-l-2 border-accent pl-6 space-y-3">
              <p
                className="font-display italic text-ink-deep text-[1.35rem] leading-[1.4]"
                style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 350' }}
              >
                &ldquo;The hardest thing a person ever writes
                is not helpful, cheerful, or polite.&rdquo;
              </p>
              <p className="eyebrow">— the premise</p>
            </div>
          </aside>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-3 gap-0 mb-24 border-y border-rule reveal-up" style={{ animationDelay: '0.55s' }}>
          <Stat
            label="Scenarios"
            value={stats.scenarios}
            caption="Each one a different hard moment."
          />
          <Stat
            label="Human contributions"
            value={stats.contributions}
            caption={stats.contributions === 0 ? 'Be the first to write.' : 'Growing with every submission.'}
            middle
          />
          <Stat
            label="Human mean score"
            value={stats.meanScore !== null ? stats.meanScore.toFixed(1) : '—'}
            caption="0–100, Sonnet-judged."
          />
        </section>

        {/* How it works */}
        <section className="grid md:grid-cols-12 gap-10 mb-24 reveal-up" style={{ animationDelay: '0.75s' }}>
          <div className="md:col-span-4">
            <p className="eyebrow mb-3">The method</p>
            <h2
              className="font-display text-ink-deep text-[2rem] leading-[1.08]"
              style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 380' }}
            >
              Five motions<br />from writer<br />to dataset.
            </h2>
          </div>
          <ol className="md:col-span-8 divide-y divide-rule-soft">
            {[
              ['I', 'Pick a scenario.', 'A specific hard message someone needs to write — a voicemail, a script, a letter.'],
              ['II', 'Write your version.', 'Short is fine. Your voice, not a model\'s.'],
              ['III', 'Get scored.', 'Claude applies the scenario\'s own rubric — a dozen criteria specific to that exact moment — and returns a 0–100.'],
              ['IV', 'See your rank.', 'Against four frontier LLMs and every human contributor before you.'],
              ['V', 'Optionally contribute.', 'Your response joins the public dataset. Training data that didn\'t exist yesterday.'],
            ].map(([numeral, title, body], i) => (
              <li key={i} className="py-5 flex gap-6">
                <span className="eyebrow text-accent-deep pt-1 shrink-0 w-12">{numeral}</span>
                <div className="space-y-1">
                  <h3
                    className="font-display text-ink-deep text-[1.2rem]"
                    style={{ fontVariationSettings: '"SOFT" 70, "opsz" 48, "wght" 520' }}
                  >
                    {title}
                  </h3>
                  <p className="text-ink-soft leading-[1.55]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Manifesto / why */}
        <section className="mb-20 reveal-up" style={{ animationDelay: '0.95s' }}>
          <div className="rule-ornament mb-10">
            <span className="eyebrow">On method</span>
          </div>
          <blockquote
            className="font-display italic text-ink text-[1.5rem] md:text-[1.85rem] leading-[1.45] max-w-[48rem] mx-auto text-center"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 340' }}
          >
            Almost every instruction-tuning corpus over-weights helpful, cheerful, polite responses.
            The hardest messages a person ever writes are not helpful, cheerful, or polite —
            they are restrained, specific, and often painful.{' '}
            <span className="text-accent-deep not-italic">A corpus of graded human responses on those exact moments is what&apos;s missing.</span>{' '}
            This is that corpus.
          </blockquote>
        </section>

        {/* Colophon */}
        <footer className="pt-10 mt-12 border-t border-rule">
          <div className="flex flex-wrap gap-8 justify-between items-baseline text-sm">
            <div className="eyebrow">Colophon</div>
            <p className="text-ink-faint max-w-md leading-[1.6]">
              A hackathon essay in evaluation and feedback infrastructure for
              emotionally intelligent writing. Scenarios authored by hand; LLMs judged by rubric;
              humans graded on the same scale.
            </p>
            <p className="eyebrow">Vol. I · Apr 2026</p>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  caption,
  middle,
}: {
  label: string;
  value: number | string;
  caption: string;
  middle?: boolean;
}) {
  return (
    <div className={`px-6 py-8 ${middle ? 'border-x border-rule' : ''}`}>
      <div className="eyebrow mb-4">{label}</div>
      <div
        className="font-display text-ink-deep text-[3.5rem] leading-none tabular-nums"
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 280' }}
      >
        {value}
      </div>
      <p className="text-ink-faint text-sm mt-4 leading-[1.55]">{caption}</p>
    </div>
  );
}
