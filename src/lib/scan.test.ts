import { describe, expect, it } from 'vitest';
import { classifyColor } from './scan';
import type { RGB } from './scan';
import type { Face } from './cube';

describe('camera colors', () => {
  const samples: [Face, RGB][] = [['U', [239, 241, 235]], ['R', [226, 48, 42]], ['L', [239, 127, 30]], ['D', [240, 212, 42]], ['F', [32, 166, 87]], ['B', [40, 88, 220]]];
  for (const [color, rgb] of samples) it(`recognizes ${color} under different brightness`, () => {
    for (const brightness of [0.45, 0.7, 1]) expect(classifyColor(rgb.map(c => Math.round(c * brightness)) as RGB).color).toBe(color);
  });
  it('marks darkness and ambiguous red/orange hues for review', () => {
    expect(classifyColor([12, 12, 12]).uncertain).toBe(true);
    expect(classifyColor([240, 75, 33]).uncertain).toBe(true);
  });
});
