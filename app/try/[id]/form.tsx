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
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-3">
        <h2
          className="font-display text-ink-deep text-[1.4rem]"
          style={{ fontVariationSettings: '"SOFT" 30, "opsz" 32, "wght" 550' }}
        >
          Your response
        </h2>
        <p className="text-ink-soft text-[0.95rem] leading-[1.65]">
          Write what you would actually say. Short is fine.
        </p>
        <textarea
          required
          minLength={1}
          maxLength={5000}
          rows={14}
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full bg-paper-raised border border-rule p-5 font-display text-[1rem] leading-[1.7] text-ink-deep focus:outline-none focus:border-accent transition placeholder:text-ink-whisper resize-vertical"
          style={{ fontVariationSettings: '"SOFT" 30, "opsz" 16, "wght" 400' }}
          placeholder="Begin here."
        />
        <div className="flex justify-end">
          <span className="font-mono text-xs text-ink-faint tabular-nums">
            {text.length} / 5000
          </span>
        </div>
      </div>

      <label className="flex items-start gap-3 text-[0.92rem] text-ink-soft leading-[1.65] p-4 border border-rule-soft bg-paper-raised cursor-pointer hover:border-rule transition">
        <input
          type="checkbox"
          checked={contribute}
          onChange={e => setContribute(e.target.checked)}
          className="mt-1 accent-accent"
        />
        <span>
          <strong className="text-ink-deep">Contribute to the public corpus.</strong>{' '}
          Anonymous — no identifying data is collected. Your response may appear in research
          exports. Leave unchecked and it stays private.
        </span>
      </label>

      {error && (
        <div className="border border-accent text-accent-deep bg-accent-wash px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || text.trim().length === 0}
        className="inline-block px-6 py-3 bg-ink text-paper-raised hover:bg-accent-deep transition disabled:opacity-40 font-display"
        style={{ fontVariationSettings: '"SOFT" 30, "wght" 500' }}
      >
        {busy ? 'Scoring (up to 30 s)…' : 'Submit for judgment'}
      </button>
    </form>
  );
}
