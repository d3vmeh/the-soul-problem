export function meanAbsoluteDeviation(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`length mismatch: ${a.length} vs ${b.length}`);
  if (a.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

export function screenerPassed(mad: number, threshold: number): boolean {
  return mad <= threshold;
}

export const SCREENER_MAD_THRESHOLD = 3.0;
