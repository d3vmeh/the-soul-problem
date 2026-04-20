import { createHash } from 'node:crypto';

function seedFrom(expertId: string, scenarioId: number): number {
  const h = createHash('sha256').update(`${expertId}:${scenarioId}`).digest();
  return h.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function blindingOrder<T>(items: T[], expertId: string, scenarioId: number): T[] {
  const rand = mulberry32(seedFrom(expertId, scenarioId));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
