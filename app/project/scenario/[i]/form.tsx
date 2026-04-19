'use client';
import { useState } from 'react';
import type { Scenario, ModelResponse } from '@/lib/types';

type Existing = {
  response_id: number;
  accountability: number;
  specificity: number;
  warmth: number;
  reasoning: string | null;
};

export default function ScenarioForm({
  scenario, responses, existing, nextScenarioId,
}: {
  scenario: Scenario;
  responses: ModelResponse[];
  existing: Existing[];
  nextScenarioId: number | null;
}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const initial: Record<number, { acc: number; spec: number; warmth: number; reasoning: string }> =
    Object.fromEntries(responses.map(r => {
      const e = existing.find(x => x.response_id === r.id);
      return [r.id, {
        acc: e?.accountability ?? 3,
        spec: e?.specificity ?? 3,
        warmth: e?.warmth ?? 3,
        reasoning: e?.reasoning ?? '',
      }];
    }));
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    for (const r of responses) {
      const v = values[r.id];
      await fetch('/api/label', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          response_id: r.id,
          accountability: v.acc, specificity: v.spec, warmth: v.warmth,
          reasoning: v.reasoning,
        }),
      });
    }
    window.location.href = nextScenarioId ? `/project/scenario/${nextScenarioId}` : '/done';
  }

  const labels: Record<'acc' | 'spec' | 'warmth', string> = {
    acc: 'Accountability',
    spec: 'Specificity',
    warmth: 'Warmth',
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Scenario</h1>
        <pre className="whitespace-pre-wrap bg-neutral-50 border rounded p-4 text-sm mt-2">
          {scenario.prompt}
        </pre>
      </div>
      <form onSubmit={submit} className="space-y-8">
        {responses.map((r, i) => {
          const v = values[r.id];
          return (
            <div key={r.id} className="border rounded p-4 space-y-3">
              <h2 className="font-medium">Response {letters[i]}</h2>
              <pre className="whitespace-pre-wrap bg-white border rounded p-3 text-sm">{r.text}</pre>
              {(['acc', 'spec', 'warmth'] as const).map(key => (
                <label key={key} className="block">
                  <div className="flex justify-between text-sm">
                    <span>{labels[key]}</span>
                    <span>{v[key]}</span>
                  </div>
                  <input
                    type="range" min={1} max={5} step={1} value={v[key]}
                    onChange={e => setValues({
                      ...values,
                      [r.id]: { ...v, [key]: Number(e.target.value) },
                    })}
                    className="w-full"
                  />
                </label>
              ))}
              <label className="block">
                <span className="block text-sm mb-1">What would make this apology better? (optional)</span>
                <textarea
                  rows={2} value={v.reasoning}
                  onChange={e => setValues({
                    ...values, [r.id]: { ...v, reasoning: e.target.value },
                  })}
                  className="w-full border rounded p-2"
                />
              </label>
            </div>
          );
        })}
        <button type="submit" disabled={busy} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
          {busy ? 'Saving…' : nextScenarioId ? 'Save & next scenario' : 'Save & finish'}
        </button>
      </form>
    </main>
  );
}
