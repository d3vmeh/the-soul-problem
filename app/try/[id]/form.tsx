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
        <p className="eyebrow">Your response</p>
        <p className="text-ink-soft text-[0.95rem] leading-[1.65]">
          Write what you would actually say. Short is fine. Judged on the scenario&apos;s own rubric.
        </p>
        <textarea
          required
          minLength={1}
          maxLength={5000}
          rows={14}
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full bg-paper-raised border border-rule p-5 font-display text-[1.05rem] leading-[1.65] text-ink-deep focus:outline-none focus:border-accent transition placeholder:text-ink-whisper resize-vertical"
          style={{ fontVariationSettings: '"SOFT" 100, "wght" 400' }}
          placeholder="Begin here…"
        />
        <div className="flex justify-end">
          <span className="font-mono text-xs text-ink-whisper tabular-nums">
            {text.length} / 5000
          </span>
        </div>
      </div>

      <label className="flex items-start gap-3 text-[0.95rem] text-ink-soft leading-[1.65] p-4 border border-rule-soft bg-paper-raised cursor-pointer hover:border-rule transition">
        <input
          type="checkbox"
          checked={contribute}
          onChange={e => setContribute(e.target.checked)}
          className="mt-1 accent-accent"
        />
        <span>
          <strong className="text-ink-deep">Contribute to the public archive.</strong>{' '}
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
        className="inline-flex items-center gap-3 px-7 py-4 bg-ink text-paper-raised hover:bg-accent-deep transition disabled:opacity-40 font-display"
        style={{ fontVariationSettings: '"SOFT" 60, "wght" 450' }}
      >
        <span className="eyebrow text-paper-raised opacity-80">→</span>
        <span className="text-lg">{busy ? 'Scoring (up to 30 s)…' : 'Submit for judgment'}</span>
      </button>
    </form>
  );
}
