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
  const meta = [md.subcategory, md.medium, md.time_since_loss, md.word_count_target]
    .filter(Boolean)
    .map(s => String(s).replace(/_/g, ' '))
    .join(' · ');

  return (
    <main className="min-h-screen fade-in">
      <div className="max-w-2xl mx-auto px-6 pt-10 pb-20">
        <header className="flex items-center justify-between pb-6 mb-8 border-b border-line">
          <Link href="/try" className="font-semibold tracking-tight text-[0.95rem]">← Scenarios</Link>
          <div className="text-[0.85rem] text-muted">#{String(scenarioId).padStart(3, '0')}</div>
        </header>

        <section className="mb-8">
          {meta && <p className="text-[0.78rem] text-faint mb-3">{meta}</p>}
          <div className="rounded-lg border border-line-subtle bg-surface p-5">
            <pre className="whitespace-pre-wrap text-[0.95rem] leading-[1.6] text-text font-sans">
              {scenario.prompt}
            </pre>
          </div>
        </section>

        <TryForm scenarioId={scenarioId} />
      </div>
    </main>
  );
}
