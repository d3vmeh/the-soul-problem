import { describe, it, expect } from 'vitest';
import { meanAbsoluteDeviation, screenerPassed } from '@/lib/scoring';

describe('meanAbsoluteDeviation', () => {
  it('returns 0 for identical vectors', () => {
    expect(meanAbsoluteDeviation([3, 5, 7], [3, 5, 7])).toBe(0);
  });

  it('returns the mean of absolute element-wise differences', () => {
    expect(meanAbsoluteDeviation([1, 2, 3], [4, 2, 6])).toBeCloseTo((3 + 0 + 3) / 3);
  });

  it('throws if lengths differ', () => {
    expect(() => meanAbsoluteDeviation([1, 2], [1, 2, 3])).toThrow();
  });
});

describe('screenerPassed', () => {
  it('passes at or below threshold', () => {
    expect(screenerPassed(2.9, 3.0)).toBe(true);
    expect(screenerPassed(3.0, 3.0)).toBe(true);
  });

  it('fails above threshold', () => {
    expect(screenerPassed(3.1, 3.0)).toBe(false);
  });
});
