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
    <main className="min-h-screen">
      <div className="max-w-[52rem] mx-auto px-8 md:px-16 pt-16 pb-24">
        <header className="flex items-baseline justify-between pb-6 mb-12 hairline reveal-in">
          <Link href="/try" className="eyebrow hover:text-ink transition">← Scenarios</Link>
          <div className="eyebrow">Scenario · {String(scenarioId).padStart(3, '0')}</div>
        </header>

        <section className="mb-12 reveal-up">
          <div className="flex flex-wrap gap-2 mb-6">
            {md.subcategory && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.subcategory).replace(/_/g, ' ')}</span>}
            {md.medium && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.medium).replace(/_/g, ' ')}</span>}
            {md.time_since_loss && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.time_since_loss).replace(/_/g, ' ')}</span>}
            {md.word_count_target && <span className="eyebrow px-2 py-0.5 bg-paper-warm border border-rule-soft">{String(md.word_count_target)}</span>}
          </div>
          <p className="eyebrow mb-3">The scenario</p>
          <pre className="whitespace-pre-wrap font-display text-[1.15rem] leading-[1.7] text-ink-deep bg-paper-raised border-l-2 border-accent pl-6 py-2" style={{ fontVariationSettings: '"SOFT" 100, "wght" 400' }}>
            {scenario.prompt}
          </pre>
        </section>

        <div className="reveal-up" style={{ animationDelay: '0.2s' }}>
          <TryForm scenarioId={scenarioId} />
        </div>
      </div>
    </main>
  );
}
