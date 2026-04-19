import { describe, it, expect } from 'vitest';
import { blindingOrder } from '@/lib/blinding';

describe('blindingOrder', () => {
  it('returns a permutation of the input', () => {
    const ids = [10, 20, 30, 40];
    const out = blindingOrder(ids, 'expert-uuid', 1);
    expect([...out].sort((a, b) => a - b)).toEqual(ids);
  });

  it('is deterministic for the same (expert, scenario)', () => {
    const ids = [10, 20, 30, 40];
    expect(blindingOrder(ids, 'e1', 1)).toEqual(blindingOrder(ids, 'e1', 1));
  });

  it('varies across experts', () => {
    const ids = [10, 20, 30, 40];
    expect(blindingOrder(ids, 'e1', 1)).not.toEqual(blindingOrder(ids, 'e2', 1));
  });
});
