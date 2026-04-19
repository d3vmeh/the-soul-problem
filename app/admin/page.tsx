import { supabaseService } from '@/lib/supabase';

export default async function AdminDashboard() {
  const db = supabaseService();
  const [{ count: experts }, { count: consented }, { count: passed }, { count: labels }] = await Promise.all([
    db.from('experts').select('*', { count: 'exact', head: true }),
    db.from('experts').select('*', { count: 'exact', head: true }).not('consent_at', 'is', null),
    db.from('experts').select('*', { count: 'exact', head: true }).eq('screener_passed', true),
    db.from('labels').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <ul className="space-y-1">
        <li>Experts invited: {experts ?? 0}</li>
        <li>Consented: {consented ?? 0}</li>
        <li>Screener passed: {passed ?? 0}</li>
        <li>Labels submitted: {labels ?? 0}</li>
      </ul>
      <a href="/admin/export.jsonl" className="inline-block px-4 py-2 rounded bg-black text-white">
        Download JSONL
      </a>
    </main>
  );
}
