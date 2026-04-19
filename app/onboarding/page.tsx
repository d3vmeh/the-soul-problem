import { redirect } from 'next/navigation';
import { getExpert } from '@/lib/session';

export default async function OnboardingPage() {
  const expert = await getExpert();
  if (!expert) redirect('/');
  if (expert.screener_passed) redirect('/project');
  if (expert.name) redirect('/screener');

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form action="/api/onboarding" method="POST" className="max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">Tell us about yourself</h1>
        <label className="block">
          <span className="block text-sm mb-1">First name or pseudonym</span>
          <input name="name" required className="w-full border rounded p-2" />
        </label>
        <label className="block">
          <span className="block text-sm mb-1">
            Anything relevant to your emotional-intelligence background (therapy, writing, teaching,
            caretaking, etc.)? Optional.
          </span>
          <textarea name="background" rows={4} className="w-full border rounded p-2" />
        </label>
        <button type="submit" className="px-4 py-2 rounded bg-black text-white">Start screener</button>
      </form>
    </main>
  );
}
