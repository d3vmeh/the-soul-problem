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
    <main className="min-h-screen page-fade">
      <div className="max-w-[50rem] mx-auto px-8 md:px-16 pt-14 pb-24">
        <header className="flex items-baseline justify-between pb-5 mb-12 border-b border-rule">
          <Link href="/try" className="label hover:text-ink transition">← Scenarios</Link>
          <div className="label">Scenario · {String(scenarioId).padStart(3, '0')}</div>
        </header>

        <section className="mb-10">
          <p className="section-number mb-2">§ Prompt</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {md.subcategory && <span className="label px-2 py-0.5 border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
            {md.medium && <span className="label px-2 py-0.5 border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
            {md.time_since_loss && <span className="label px-2 py-0.5 border border-rule-soft">{String(md.time_since_loss).replace(/_/g, ' ')}</span>}
            {md.word_count_target && <span className="label px-2 py-0.5 border border-rule-soft">{String(md.word_count_target)}</span>}
          </div>
          <div className="border-l-2 border-accent pl-5 py-1">
            <pre className="whitespace-pre-wrap font-display text-[1.05rem] leading-[1.7] text-ink-deep" style={{ fontVariationSettings: '"SOFT" 0, "opsz" 24, "wght" 420' }}>
              {scenario.prompt}
            </pre>
          </div>
        </section>

        <TryForm scenarioId={scenarioId} />
      </div>
    </main>
  );
}
