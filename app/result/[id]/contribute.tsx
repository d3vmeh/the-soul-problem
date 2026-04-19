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
        className="inline-block px-5 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition"
      >
        {busy ? 'Contributing…' : 'Contribute to the dataset'}
      </button>
      {error && <div className="text-sm text-red-800">{error}</div>}
    </div>
  );
}
