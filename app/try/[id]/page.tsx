import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';
import TryForm from './form';

export default async function TryScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenarioId = Number(id);
  if (!Number.isFinite(scenarioId)) notFound();

  const db = supabaseService();
  const { data: scenario } = await db
    .from('scenarios')
    .select('id, prompt, metadata')
    .eq('id', scenarioId)
    .single();
  if (!scenario) notFound();

  const md = (scenario.metadata ?? {}) as any;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/try" className="text-sm text-neutral-500 hover:text-neutral-700">
            ← scenarios
          </Link>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wider text-neutral-500">
            {md.subcategory && <span className="rounded bg-neutral-100 px-2 py-0.5">{md.subcategory.replace(/_/g, ' ')}</span>}
            {md.medium && <span className="rounded bg-neutral-100 px-2 py-0.5">{md.medium.replace(/_/g, ' ')}</span>}
            {md.time_since_loss && <span className="rounded bg-neutral-100 px-2 py-0.5">{md.time_since_loss}</span>}
            {md.word_count_target && <span className="rounded bg-neutral-100 px-2 py-0.5">{md.word_count_target}</span>}
          </div>
        </header>

        <section className="space-y-2">
          <h1 className="text-lg font-semibold text-neutral-900">The scenario</h1>
          <pre className="whitespace-pre-wrap bg-neutral-50 border border-neutral-200 rounded-lg p-5 text-[15px] leading-relaxed text-neutral-800 font-sans">
            {scenario.prompt}
          </pre>
        </section>

        <TryForm scenarioId={scenarioId} />
      </div>
    </main>
  );
}
