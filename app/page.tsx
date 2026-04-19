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
      <div className="max-w-[62rem] mx-auto px-8 md:px-16 pt-14 pb-24">
        {/* Masthead */}
        <header className="flex items-baseline justify-between pb-5 mb-16 border-b border-rule">
          <div className="label">The Soul Problem · working paper</div>
          <nav className="label flex gap-6">
            <Link href="/try" className="hover:text-ink transition">Contribute</Link>
            <Link href="/leaderboard" className="hover:text-ink transition">Results</Link>
            <Link href="/dataset" className="hover:text-ink transition">Corpus</Link>
            <Link href="/dataset/export" className="hover:text-ink transition">Download</Link>
          </nav>
        </header>

        {/* Title block — single column, centered, like a paper */}
        <section className="max-w-[44rem] mb-16">
          <p className="label mb-6">An evaluation benchmark for emotionally intelligent writing</p>
          <h1
            className="font-display text-ink-deep text-[2.75rem] md:text-[3.4rem] leading-[1.02] mb-8"
            style={{ fontVariationSettings: '"SOFT" 0, "opsz" 144, "wght" 420' }}
          >
            The Soul Problem: a rubric-graded corpus of{' '}
            <em className="italic">messages LLMs get wrong.</em>
          </h1>
          <p className="text-ink-faint text-[0.92rem] mb-6 font-mono">
            sumeet mehra, the soul-problem collective &nbsp;·&nbsp; v0.1 &nbsp;·&nbsp; april 2026
          </p>
          <div className="border border-rule-soft bg-paper-raised px-6 py-6">
            <p className="label mb-2">Abstract</p>
            <p className="text-ink-soft text-[0.98rem] leading-[1.65]">
              We introduce a small but growing benchmark of emotionally high-stakes writing tasks —
              voicemails after a suicide, layoff scripts, miscarriage cards — each accompanied by a
              hand-authored rubric of positive and negative criteria.{' '}
              Responses from four frontier language models and {stats.contributions} human
              contributor{stats.contributions === 1 ? '' : 's'} are judged against the same rubric by
              Claude Sonnet 4.6 using structured tool-use, yielding a 0–100 Overall Item Score.
              We report a measurable in-context-learning effect of the contributed corpus on a weaker
              student model (Claude Haiku 4.5) and release the dataset in five formats for downstream
              supervised and preference-based training.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/try"
              className="inline-flex items-center gap-3 px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition font-display"
              style={{ fontVariationSettings: '"SOFT" 0, "wght" 450' }}
            >
              <span className="label text-paper-raised opacity-70">§1</span>
              <span>Contribute a response</span>
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-3 px-6 py-3 border border-rule hover:border-ink transition font-display text-ink"
              style={{ fontVariationSettings: '"SOFT" 0, "wght" 400' }}
            >
              <span className="label">§3</span>
              <span>See results</span>
            </Link>
            <Link
              href="/dataset/export"
              className="inline-flex items-center gap-3 px-6 py-3 border border-rule hover:border-ink transition font-display text-ink"
              style={{ fontVariationSettings: '"SOFT" 0, "wght" 400' }}
            >
              <span className="label">§A</span>
              <span>Download data</span>
            </Link>
          </div>
        </section>

        {/* Figure 1 — live counts */}
        <section className="mb-16">
          <div className="border-y border-rule py-6 grid grid-cols-3 gap-0">
            <StatCell label="Scenarios" value={stats.scenarios} />
            <StatCell label="Human contributions" value={stats.contributions} middle />
            <StatCell
              label="Human mean score"
              value={stats.meanScore !== null ? stats.meanScore.toFixed(1) : '—'}
              suffix="/ 100"
            />
          </div>
          <p className="caption mt-3 text-right">
            Figure 1. Corpus state, live from database, cached 30 s.
          </p>
        </section>

        {/* Method — numbered sections */}
        <section className="grid md:grid-cols-[1fr_2fr] gap-12 mb-20">
          <div>
            <p className="section-number mb-2">§ 2.</p>
            <h2
              className="font-display text-ink-deep text-[1.6rem] leading-[1.15]"
              style={{ fontVariationSettings: '"SOFT" 0, "opsz" 48, "wght" 500' }}
            >
              Method
            </h2>
            <p className="sidenote mt-3 max-w-[18rem]">
              The platform is the data-collection apparatus. Every contribution increments the
              corpus in the measurement.
            </p>
          </div>
          <ol className="space-y-6">
            {[
              ['2.1', 'Scenario selection', 'The participant selects one of the grief/loss scenarios from the corpus. Each is a first-person user prompt to an LLM, with a pre-authored rubric of 12+ positive and negative criteria and a weights hint naming 2–3 dominant criteria.'],
              ['2.2', 'Response elicitation', 'The participant writes their own ideal response in a plain textarea. We do not provide templates, word banks, or draft assistance from any model.'],
              ['2.3', 'Structured scoring', 'Claude Sonnet 4.6 is invoked with tool-use enforced against a typed schema: each criterion receives an integer in [1,10]. The overall score is computed client-side from per-criterion scores using the dominant-weighted formula from the rubric specification.'],
              ['2.4', 'Contribution', 'If the participant opts in, the response joins the public corpus with anonymous attribution. Otherwise it remains local to the result page.'],
              ['2.5', 'In-context evaluation', 'For each submission, we compute Claude Haiku 4.5\'s score on the same scenario under three conditions: baseline, with the participant\'s response as a single in-context example, and with the full public corpus as examples. The delta is reported as the dataset\'s measurable effect.'],
            ].map(([n, title, body]) => (
              <li key={n} className="grid grid-cols-[48px_1fr] gap-4">
                <span className="section-number pt-1">§{n}</span>
                <div>
                  <h3
                    className="font-display text-[1.1rem] text-ink-deep mb-1"
                    style={{ fontVariationSettings: '"SOFT" 0, "opsz" 24, "wght" 520' }}
                  >
                    {title}
                  </h3>
                  <p className="text-ink-soft text-[0.95rem] leading-[1.65]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Motivation */}
        <section className="grid md:grid-cols-[1fr_2fr] gap-12 mb-20">
          <div>
            <p className="section-number mb-2">§ 1.</p>
            <h2
              className="font-display text-ink-deep text-[1.6rem] leading-[1.15]"
              style={{ fontVariationSettings: '"SOFT" 0, "opsz" 48, "wght" 500' }}
            >
              Motivation
            </h2>
          </div>
          <div className="space-y-4 text-ink-soft leading-[1.7]">
            <p>
              Contemporary instruction-tuning corpora over-weight helpful, cheerful, polite
              responses.<sup>[1]</sup> The hardest messages a person ever writes — voicemails after a
              suicide, scripts for a layoff, letters to the terminally ill — are not helpful, cheerful,
              or polite. They are restrained, specific, and frequently painful.
            </p>
            <p>
              When asked to produce such messages, frontier models exhibit a characteristic failure
              pattern: platitudes, euphemism, silver-linings, demand for reciprocity, and subtle
              centering of the writer rather than the subject. These failures are not captured by
              generic helpfulness or harmlessness metrics. A graded corpus of human responses on these
              specific moments is what is missing.
            </p>
            <p className="italic">
              This project is that corpus, together with the measurement apparatus that produces it.
            </p>
          </div>
        </section>

        <footer className="pt-8 border-t border-rule text-[0.85rem] text-ink-faint leading-[1.6]">
          <p className="mb-3">
            <sup>[1]</sup> Findings cited informally; not peer-reviewed. See the EQ-Bench family of
            benchmarks (Paech et al.) for adjacent prior art on restrained-register evaluation.
          </p>
          <div className="flex justify-between items-baseline mt-6">
            <span className="label">Working paper · hackathon draft</span>
            <span className="label">The Soul Problem · Apr 2026</span>
          </div>
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
    <div className={`px-4 ${middle ? 'border-x border-rule-soft' : ''}`}>
      <div className="label mb-3">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-display text-ink-deep text-[2.8rem] leading-none tabular-nums"
          style={{ fontVariationSettings: '"SOFT" 0, "opsz" 144, "wght" 380' }}
        >
          {value}
        </span>
        {suffix && <span className="label">{suffix}</span>}
      </div>
    </div>
  );
}
