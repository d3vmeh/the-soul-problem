import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export default async function TryPage() {
  const db = supabaseService();
  const { data: scenarios } = await db
    .from('scenarios')
    .select('id, prompt, metadata')
    .order('id')
    .limit(10);

  return (
    <main className="min-h-screen">
      <div className="max-w-[56rem] mx-auto px-8 md:px-16 pt-16 pb-24">
        <header className="flex items-baseline justify-between pb-6 mb-16 hairline reveal-in">
          <Link href="/" className="eyebrow hover:text-ink transition">← The Soul Problem</Link>
          <div className="eyebrow">The scenarios</div>
        </header>

        <section className="mb-16 reveal-up">
          <p className="eyebrow mb-3">Choose a hard message</p>
          <h1
            className="font-display text-ink-deep text-[3.5rem] md:text-[4.5rem] leading-[0.95] mb-6"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 320' }}
          >
            Each one is a thing<br />
            <em className="italic text-accent-deep">someone actually has to say.</em>
          </h1>
          <p className="text-[1.05rem] leading-[1.7] text-ink-soft max-w-[42rem]">
            A voicemail after a death. A layoff script. A card for a miscarriage. Pick one and write
            what you think the ideal response would be. We&apos;ll score it against a rubric written
            specifically for this exact moment.
          </p>
        </section>

        <section className="divide-y divide-rule reveal-up" style={{ animationDelay: '0.2s' }}>
          {(scenarios ?? []).map((s, i) => {
            const md = (s.metadata ?? {}) as any;
            const preview = s.prompt.length > 260 ? s.prompt.slice(0, 260).trim() + '…' : s.prompt;
            return (
              <Link
                key={s.id}
                href={`/try/${s.id}`}
                className="group grid grid-cols-[48px_1fr_auto] gap-6 py-10 items-start hover:bg-paper-warm/60 transition -mx-4 px-4"
              >
                <span className="font-mono text-sm tabular-nums text-ink-whisper pt-2">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {md.subcategory && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
                    {md.medium && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
                    {md.time_since_loss && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.time_since_loss).replace(/_/g, ' ')}</span>}
                  </div>
                  <p className="font-display text-[1.1rem] leading-[1.6] text-ink-deep max-w-[42rem]" style={{ fontVariationSettings: '"SOFT" 100, "wght" 400' }}>
                    {preview}
                  </p>
                </div>
                <span
                  className="eyebrow self-center group-hover:text-accent-deep transition"
                >
                  Write →
                </span>
              </Link>
            );
          })}
        </section>

        <footer className="pt-12 mt-12 border-t border-rule text-ink-faint text-sm leading-[1.7]">
          <p>
            You can submit anonymously. By default your response stays private; you opt in to
            contributing it to the public dataset.
          </p>
        </footer>
      </div>
    </main>
  );
}
