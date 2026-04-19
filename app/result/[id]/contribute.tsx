'use client';
import { useState } from 'react';

export default function ContributeButton({ responseId }: { responseId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response_id: responseId }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? 'failed');
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="inline-flex items-center gap-3 px-5 py-3 bg-accent text-paper-raised hover:bg-accent-deep transition disabled:opacity-50 font-display"
        style={{ fontVariationSettings: '"SOFT" 0, "wght" 450' }}
      >
        <span className="label text-paper-raised opacity-70">→</span>
        <span>{busy ? 'Contributing…' : 'Contribute to the corpus'}</span>
      </button>
      {error && <div className="text-sm text-accent-deep">{error}</div>}
    </div>
  );
}
