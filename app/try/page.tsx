import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export default async function TryPage() {
  const db = supabaseService();
  const { data: scenarios } = await db
    .from('scenarios')
    .select('id, prompt, metadata')
    .order('id')
    .limit(30);

  return (
    <main className="min-h-screen page-fade">
      <div className="max-w-[56rem] mx-auto px-8 md:px-14 pt-12 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-12 hairline">
          <Link href="/" className="font-display text-ink-deep text-[1.05rem]" style={{ fontVariationSettings: '"SOFT" 30, "wght" 600' }}>
            ← The Soul Problem
          </Link>
          <div className="text-[0.92rem] text-ink-soft">Scenarios</div>
        </header>

        <section className="max-w-[44rem] mb-12">
          <h1
            className="font-display text-ink-deep text-[2.4rem] md:text-[2.9rem] leading-[1.05] mb-5"
            style={{ fontVariationSettings: '"SOFT" 30, "opsz" 144, "wght" 400' }}
          >
            Choose a scenario.
          </h1>
          <p className="text-ink-soft text-[1.02rem] leading-[1.65]">
            Each one is a specific hard message someone needs to write. Pick one, write what you
            think the ideal response would be. We&apos;ll score it against a rubric built for that
            exact moment.
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
                className="group grid grid-cols-[40px_1fr_auto] gap-5 py-7 items-start border-b border-rule-soft hover:bg-paper-raised transition -mx-3 px-3"
              >
                <span className="font-mono text-sm tabular-nums text-ink-faint pt-1">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {md.subcategory && <span className="tag px-2 py-0.5 border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
                    {md.medium && <span className="tag px-2 py-0.5 border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
                    {md.time_since_loss && <span className="tag px-2 py-0.5 border border-rule-soft">{String(md.time_since_loss).replace(/_/g, ' ')}</span>}
                  </div>
                  <p className="font-display text-[1rem] leading-[1.65] text-ink-deep max-w-[44rem]" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 18, "wght" 420' }}>
                    {preview}
                  </p>
                </div>
                <span className="text-[0.9rem] text-ink-soft group-hover:text-accent transition self-center">
                  Write →
                </span>
              </Link>
            );
          })}
        </section>

        <footer className="pt-10 mt-8 border-t border-rule">
          <p className="text-ink-faint text-[0.9rem] leading-[1.65] max-w-[42rem]">
            Submissions are anonymous. No identifying data is collected. By default your response
            stays private; you opt in to joining the public corpus at submission time.
          </p>
        </footer>
      </div>
    </main>
  );
}
