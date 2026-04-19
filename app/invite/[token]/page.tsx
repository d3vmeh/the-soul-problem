import { notFound } from 'next/navigation';
import { supabaseService } from '@/lib/supabase';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = supabaseService();
  const { data: expert } = await db.from('experts').select('id').eq('invite_token', token).single();
  if (!expert) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form action="/api/consent" method="POST" className="max-w-xl space-y-6">
        <input type="hidden" name="token" value={token} />
        <h1 className="text-2xl font-semibold">Welcome to the EQ Apologies study</h1>
        <p>
          You've been invited to help evaluate how well AI models write apologies on behalf of people
          in hard situations. You will read scenarios and rate four responses per scenario on three
          dimensions. Expect about 40 minutes.
        </p>
        <div className="rounded border p-4 bg-amber-50">
          <strong>Content warning:</strong> scenarios describe interpersonal conflict (neglect, betrayal,
          boundary violations). You may exit at any time.
        </div>
        <label className="flex gap-2 items-start">
          <input type="checkbox" name="consent" required />
          <span>
            I consent to my ratings and written reasoning being published as part of a public benchmark
            dataset, attributed only as "Expert N". I may request removal at any time.
          </span>
        </label>
        <button type="submit" className="px-4 py-2 rounded bg-black text-white">I agree — continue</button>
      </form>
    </main>
  );
}
