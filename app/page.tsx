export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-3xl mx-auto px-6 py-24 space-y-12">
        <header className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            The Soul Problem
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
            What are the hardest things an AI is asked to write — and does it do them well?
          </h1>
          <p className="text-lg text-neutral-600 max-w-2xl">
            A human-expert benchmark of how large language models handle the messages
            people actually struggle to write: apologies, eulogies, condolences,
            layoffs, letters to estranged family, last words.
          </p>
        </header>

        <section className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Scenarios
            </div>
            <div className="text-2xl font-semibold">50</div>
            <p className="text-neutral-600 mt-1">
              Real grief and loss prompts — voicemails, layoff scripts, condolence emails.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Models
            </div>
            <div className="text-2xl font-semibold">4</div>
            <p className="text-neutral-600 mt-1">
              Each prompt answered by four frontier models, blinded and shuffled.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Raters
            </div>
            <div className="text-2xl font-semibold">3 per prompt</div>
            <p className="text-neutral-600 mt-1">
              Vetted via a short emotional-intensity screener before labeling.
            </p>
          </div>
        </section>

        <section className="space-y-3 text-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-900">
            How it works
          </h2>
          <ol className="list-decimal list-inside space-y-1 text-neutral-600">
            <li>Expert arrives via an invite link.</li>
            <li>Passes a brief EQ screener calibrated against a human reference.</li>
            <li>Labels 10 scenarios × 4 model responses, blind to the models behind them.</li>
            <li>Rates accountability, specificity, and warmth on a 1–5 scale and writes a short note.</li>
          </ol>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
          If you have an invite link, open it directly — e.g.{' '}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-800">
            /invite/your-token
          </code>
          . This is a research platform; there is no public sign-up.
        </section>

        <footer className="text-xs text-neutral-400 pt-4 border-t border-neutral-200">
          A hackathon project on emotional intelligence in large language models.
        </footer>
      </div>
    </main>
  );
}
