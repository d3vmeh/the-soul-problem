import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-3xl mx-auto px-6 py-24 space-y-14">
        <header className="space-y-5">
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            The Soul Problem
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold leading-[1.1]">
            Write the hardest thing you'll write this year.
            <br />
            We'll tell you how it lands.
          </h1>
          <p className="text-lg text-neutral-600 max-w-2xl">
            A voicemail after a suicide. A script for a layoff you didn't choose. A card for a
            miscarriage. An eulogy for a man who died doing what he loved. Write what you think
            the ideal response would be. We score it against a scenario-specific rubric.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/try"
              className="inline-block px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition"
            >
              Try a scenario
            </Link>
            <Link
              href="#how-it-works"
              className="inline-block px-6 py-3 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition"
            >
              How it works
            </Link>
          </div>
        </header>

        <section id="how-it-works" className="space-y-4 text-neutral-700">
          <h2 className="text-xl font-semibold text-neutral-900">How it works</h2>
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">1</span>
              <span>Pick a scenario — a specific hard message someone needs to write.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">2</span>
              <span>Write your version. Short is fine.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">3</span>
              <span>
                Claude scores it against the scenario's own rubric — a dozen positive and negative criteria
                specific to that moment — and returns a 0–100 overall with a per-criterion breakdown.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center">4</span>
              <span>
                Optionally contribute your response to a public dataset of how humans handle the hardest
                writing tasks. Your submission is anonymous.
              </span>
            </li>
          </ol>
        </section>

        <section className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Scenarios</div>
            <div className="text-2xl font-semibold">50 grief &amp; loss</div>
            <p className="text-neutral-600 mt-1">Voicemails, layoff scripts, condolence emails, eulogies, miscarriage cards.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Rubric</div>
            <div className="text-2xl font-semibold">Per-prompt</div>
            <p className="text-neutral-600 mt-1">Each scenario has its own 12+ criteria. No generic "empathy" scale.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Judge</div>
            <div className="text-2xl font-semibold">Claude Sonnet 4.6</div>
            <p className="text-neutral-600 mt-1">Scores positive and negative criteria independently, 0–100 overall.</p>
          </div>
        </section>

        <footer className="text-xs text-neutral-400 pt-4 border-t border-neutral-200">
          A hackathon project on emotional intelligence in large language models.
        </footer>
      </div>
    </main>
  );
}
