import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';

export default async function DonePage() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  const db = supabaseService();
  const { count } = await db
    .from('labels')
    .select('*', { count: 'exact', head: true })
    .eq('expert_id', expert.id);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4">
        <h1 className="text-2xl font-semibold">Thank you, {expert.name}</h1>
        <p>You submitted {count ?? 0} labels. We'll be in touch if we need anything else.</p>
      </div>
    </main>
  );
}
