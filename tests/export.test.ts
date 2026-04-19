import { describe, it, expect } from 'vitest';
import { assembleExportRow } from '@/lib/export';

describe('assembleExportRow', () => {
  it('assembles a single JSON row from joined parts', () => {
    const row = assembleExportRow({
      expert: { id: 'exp-1', background: 'therapist' },
      scenario: { id: 1, prompt: 'help me apologize', metadata: { severity: 'high' } },
      response: { id: 10, scenario_id: 1, model: 'claude-opus-4-7', text: 'I am sorry' },
      label: {
        expert_id: 'exp-1', response_id: 10,
        accountability: 4, specificity: 5, warmth: 3,
        reasoning: 'warm but vague', submitted_at: '2026-04-19T12:00:00Z',
      },
    });
    expect(row).toEqual({
      expert_id: 'exp-1',
      expert_background: 'therapist',
      scenario_id: 1,
      scenario_prompt: 'help me apologize',
      scenario_metadata: { severity: 'high' },
      response_id: 10,
      model: 'claude-opus-4-7',
      response_text: 'I am sorry',
      scores: { accountability: 4, specificity: 5, warmth: 3 },
      reasoning: 'warm but vague',
      submitted_at: '2026-04-19T12:00:00Z',
    });
  });
});
