import { describe, it, expect } from 'vitest';
import { pickScenariosForNewExpert } from '@/lib/assignments';

describe('pickScenariosForNewExpert', () => {
  it('picks the N scenarios with the fewest current graders', () => {
    const counts = new Map<number, number>([
      [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
      [6, 1], [7, 1], [8, 2], [9, 2], [10, 3],
      [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
      [16, 0], [17, 0], [18, 0], [19, 0], [20, 0],
    ]);
    const picked = pickScenariosForNewExpert({
      graderCounts: counts,
      scenariosPerExpert: 10,
      gradersPerScenario: 3,
    });
    expect(picked).toHaveLength(10);
    // All picks must currently have < 3 graders
    for (const id of picked) expect(counts.get(id)!).toBeLessThan(3);
    // Prefer the lowest counts: the 10 zeros should all be picked before any 1s or 2s
    for (const id of picked) expect(counts.get(id)!).toBe(0);
  });

  it('excludes scenarios already at the grader cap', () => {
    const counts = new Map<number, number>([
      [1, 3], [2, 3], [3, 3], [4, 0], [5, 0],
    ]);
    const picked = pickScenariosForNewExpert({
      graderCounts: counts,
      scenariosPerExpert: 10,
      gradersPerScenario: 3,
    });
    expect(picked).toEqual([4, 5]);
  });

  it('breaks ties by ascending scenario id', () => {
    const counts = new Map<number, number>([
      [3, 0], [1, 0], [2, 0],
    ]);
    const picked = pickScenariosForNewExpert({
      graderCounts: counts,
      scenariosPerExpert: 2,
      gradersPerScenario: 3,
    });
    expect(picked).toEqual([1, 2]);
  });
});
