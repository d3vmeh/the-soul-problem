import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';
import { supabaseService } from '@/lib/supabase';
import ScreenerForm from './form';

export default async function ScreenerPage() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (expert.screener_passed === true) redirect('/project');
  if (expert.screener_passed === false) redirect('/screener/thanks');

  const db = supabaseService();
  const { data: questions } = await db.from('screener_questions').select('*').order('id');
  return <ScreenerForm questions={questions ?? []} />;
}
