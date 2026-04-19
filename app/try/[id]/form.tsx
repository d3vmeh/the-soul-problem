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
      <div>
        <label className="block text-[0.85rem] font-medium mb-2">Your response</label>
        <textarea
          required
          minLength={1}
          maxLength={5000}
          rows={12}
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full bg-bg border border-line rounded-lg p-4 text-[0.95rem] leading-[1.6] text-text focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition placeholder:text-faint resize-vertical"
          placeholder="Write what you would actually say. Short is fine."
        />
        <div className="flex justify-end mt-1">
          <span className="font-mono text-xs text-faint tabular-nums">{text.length} / 5000</span>
        </div>
      </div>

      <label className="flex items-start gap-3 text-[0.88rem] text-muted leading-[1.55] p-3 rounded-lg border border-line-subtle bg-surface cursor-pointer hover:border-line transition">
        <input
          type="checkbox"
          checked={contribute}
          onChange={e => setContribute(e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>
          <strong className="text-text font-medium">Contribute to the public corpus.</strong>{' '}
          Anonymous; no identifying data collected. Leave unchecked and it stays private.
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-2.5 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || text.trim().length === 0}
        className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? 'Scoring (up to 30 s)…' : 'Submit for judgment'}
      </button>
    </form>
  );
}
