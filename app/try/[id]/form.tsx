'use client';
import { useState } from 'react';

export default function TryForm({ scenarioId }: { scenarioId: number }) {
  const [text, setText] = useState('');
  const [contribute, setContribute] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId, text, contribute }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'submission failed');
      window.location.href = `/result/${data.response_id}`;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="response" className="block text-lg font-semibold text-neutral-900">
          Your response
        </label>
        <p className="text-sm text-neutral-600">
          Write what you would actually say. We'll score it against the criteria the scenario sets.
          Most useful if you try — even a short attempt beats a generic one.
        </p>
        <textarea
          id="response"
          required
          minLength={1}
          maxLength={5000}
          rows={12}
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full border border-neutral-300 rounded-lg p-4 text-[15px] leading-relaxed text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-800 focus:border-transparent"
          placeholder="Type your response here..."
        />
        <div className="text-xs text-neutral-500 text-right">{text.length} / 5000</div>
      </div>

      <label className="flex items-start gap-3 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={contribute}
          onChange={e => setContribute(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Contribute to the public dataset.</strong> If you check this, your response (but not any identifying info —
          there is none collected) may appear in research exports. Leave unchecked and your response stays private; only you
          see your score.
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || text.trim().length === 0}
        className="w-full md:w-auto px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium disabled:opacity-50 hover:bg-neutral-800 transition"
      >
        {busy ? 'Scoring (up to 30 s)…' : 'Submit for scoring'}
      </button>
    </form>
  );
}
