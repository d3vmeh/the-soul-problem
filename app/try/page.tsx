import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';

export default async function TryPage() {
  const db = supabaseService();
  const { data: scenarios } = await db
    .from('scenarios')
    .select('id, prompt, metadata')
    .order('id')
    .limit(3);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-700">
            ← home
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            Pick a scenario
          </h1>
          <p className="text-neutral-600 max-w-2xl">
            Each one is a hard message a real person might need to write — a voicemail after a death,
            a script for a layoff meeting, a text to a friend. Write what you think the ideal response would
            be. We'll score it against a per-scenario rubric and show you where it lands.
          </p>
        </header>

        <section className="space-y-4">
          {(scenarios ?? []).map(s => {
            const md = (s.metadata ?? {}) as any;
            const preview = s.prompt.length > 280 ? s.prompt.slice(0, 280).trim() + '…' : s.prompt;
            return (
              <Link
                key={s.id}
                href={`/try/${s.id}`}
                className="block rounded-xl border border-neutral-200 bg-white p-6 hover:border-neutral-400 transition"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500 mb-3">
                  {md.subcategory && <span>{md.subcategory.replace(/_/g, ' ')}</span>}
                  {md.medium && <><span>·</span><span>{md.medium.replace(/_/g, ' ')}</span></>}
                  {md.time_since_loss && <><span>·</span><span>{md.time_since_loss}</span></>}
                  {md.word_count_target && <><span>·</span><span>{md.word_count_target}</span></>}
                </div>
                <p className="text-neutral-800 leading-relaxed">
                  {preview}
                </p>
                <div className="mt-4 text-sm text-neutral-500">
                  Try this scenario →
                </div>
              </Link>
            );
          })}
        </section>

        <footer className="text-xs text-neutral-400 pt-4 border-t border-neutral-200">
          You can submit anonymously. By default your response is private; you can opt in to contributing it to the public dataset.
        </footer>
      </div>
    </main>
  );
}
