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
    <main className="min-h-screen fade-in">
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-10 border-b border-line">
          <Link href="/" className="font-semibold tracking-tight text-[0.95rem]">← The Soul Problem</Link>
          <div className="text-[0.85rem] text-muted">Scenarios</div>
        </header>

        <section className="mb-10">
          <h1 className="text-[2rem] font-semibold tracking-tight leading-[1.1] mb-3">Choose a scenario.</h1>
          <p className="text-muted leading-[1.55] max-w-2xl">
            Pick one and write what you think the ideal response would be. We&apos;ll score it against a
            rubric built for that exact moment.
          </p>
        </section>

        <section className="space-y-2">
          {(scenarios ?? []).map((s, i) => {
            const md = (s.metadata ?? {}) as any;
            const preview = s.prompt.length > 220 ? s.prompt.slice(0, 220).trim() + '…' : s.prompt;
            const meta = [md.subcategory, md.medium, md.time_since_loss]
              .filter(Boolean)
              .map(s => String(s).replace(/_/g, ' '))
              .join(' · ');
            return (
              <Link
                key={s.id}
                href={`/try/${s.id}`}
                className="group block rounded-lg border border-line-subtle bg-surface hover:bg-surface-2 hover:border-line transition p-5"
              >
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-mono text-xs text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {meta && <span className="text-[0.78rem] text-faint">{meta}</span>}
                </div>
                <p className="text-[0.95rem] leading-[1.6] text-text">{preview}</p>
                <div className="mt-3 text-[0.85rem] text-muted group-hover:text-accent transition">
                  Write →
                </div>
              </Link>
            );
          })}
        </section>

        <footer className="pt-10 mt-10 border-t border-line-subtle text-faint text-[0.85rem] leading-[1.6]">
          Anonymous. No identifying data collected. Contributions to the public corpus are opt-in per submission.
        </footer>
      </div>
    </main>
  );
}
