'use client';
import { useState } from 'react';
import type { ScreenerQuestion } from '@/lib/types';

export default function ScreenerForm({ questions }: { questions: ScreenerQuestion[] }) {
  const [values, setValues] = useState<Record<number, number[]>>(
    Object.fromEntries(questions.map(q => [q.id, q.emotions.map(() => 5)]))
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/screener/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: values }),
    });
    if (res.redirected) window.location.href = res.url;
    else setBusy(false);
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">EQ Screener</h1>
      <p className="text-neutral-600">
        Read each dialogue, then set the slider for how strongly the character feels each emotion
        (0 = not at all, 10 = intense). Your answers are compared to a reference.
      </p>
      <form onSubmit={submit} className="space-y-10">
        {questions.map((q, idx) => (
          <div key={q.id} className="border rounded p-4 space-y-4">
            <h2 className="font-medium">Scenario {idx + 1}</h2>
            <pre className="whitespace-pre-wrap text-sm">{q.prompt}</pre>
            {q.emotions.map((emo, i) => (
              <label key={emo} className="block">
                <div className="flex justify-between text-sm">
                  <span>{emo}</span>
                  <span>{values[q.id][i]}</span>
                </div>
                <input
                  type="range" min={0} max={10} step={1}
                  value={values[q.id][i]}
                  onChange={e => {
                    const next = [...values[q.id]];
                    next[i] = Number(e.target.value);
                    setValues({ ...values, [q.id]: next });
                  }}
                  className="w-full"
                />
              </label>
            ))}
          </div>
        ))}
        <button type="submit" disabled={busy} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
          {busy ? 'Scoring…' : 'Submit screener'}
        </button>
      </form>
    </main>
  );
}
