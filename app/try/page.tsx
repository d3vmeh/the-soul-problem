import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export default async function TryPage() {
  const db = supabaseService();
  const { data: scenarios } = await db
    .from('scenarios')
    .select('id, prompt, metadata')
    .order('id')
    .limit(20);

  return (
    <main className="min-h-screen page-fade">
      <div className="max-w-[58rem] mx-auto px-8 md:px-16 pt-14 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-14 border-b border-rule">
          <Link href="/" className="label hover:text-ink transition">← The Soul Problem</Link>
          <div className="label">§ 1. Scenarios</div>
        </header>

        <section className="max-w-[44rem] mb-14">
          <p className="section-number mb-2">§ 1.</p>
          <h1
            className="font-display text-ink-deep text-[2.6rem] md:text-[3rem] leading-[1.05] mb-5"
            style={{ fontVariationSettings: '"SOFT" 0, "opsz" 144, "wght" 420' }}
          >
            Choose a scenario. Each is a message{' '}
            <em className="italic">someone actually has to write.</em>
          </h1>
          <p className="text-ink-soft text-[0.98rem] leading-[1.7]">
            Each scenario comes with a pre-authored rubric of twelve or more positive and negative
            criteria plus a weights hint identifying the dominant tests. Your response will be
            judged against its scenario&apos;s own rubric — not a generic empathy scale.
          </p>
        </section>

        <section className="border-t border-rule">
          {(scenarios ?? []).map((s, i) => {
            const md = (s.metadata ?? {}) as any;
            const preview = s.prompt.length > 260 ? s.prompt.slice(0, 260).trim() + '…' : s.prompt;
            return (
              <Link
                key={s.id}
                href={`/try/${s.id}`}
                className="group grid grid-cols-[44px_1fr_auto] gap-6 py-8 items-start border-b border-rule-soft hover:bg-paper-raised transition -mx-4 px-4"
              >
                <span className="font-mono text-xs tabular-nums text-ink-whisper pt-1">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {md.subcategory && <span className="label px-2 py-0.5 border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
                    {md.medium && <span className="label px-2 py-0.5 border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
                    {md.time_since_loss && <span className="label px-2 py-0.5 border border-rule-soft">{String(md.time_since_loss).replace(/_/g, ' ')}</span>}
                  </div>
                  <p className="font-display text-[1rem] leading-[1.7] text-ink-deep max-w-[44rem]" style={{ fontVariationSettings: '"SOFT" 0, "opsz" 18, "wght" 400' }}>
                    {preview}
                  </p>
                </div>
                <span className="label self-center group-hover:text-accent transition">
                  Write →
                </span>
              </Link>
            );
          })}
        </section>

        <footer className="pt-10 mt-12 border-t border-rule">
          <p className="text-ink-faint text-[0.88rem] leading-[1.7] max-w-[42rem]">
            Submissions are anonymous. No identifying data is collected. By default your response
            stays private; you opt in to joining the public corpus at submission time.
          </p>
        </footer>
      </div>
    </main>
  );
}
