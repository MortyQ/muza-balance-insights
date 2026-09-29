// The home filter row: when the person buttons fit centred between the month and «Updated …».
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { describe, expect, it } from 'vitest';
import { fitsCenter } from '@/widgets/global-filters/utils.ts';

describe('fitsCenter', () => {
  it('the middle column is the row minus two of the wider side and two gaps', () => {
    // 1000 - 2 * 300 - 2 * 12 = 376
    expect(fitsCenter({ row: 1000, left: 300, right: 200, center: 376 }, 12)).toBe(true);
    expect(fitsCenter({ row: 1000, left: 300, right: 200, center: 377 }, 12)).toBe(false);
    expect(fitsCenter({ row: 1000, left: 200, right: 300, center: 377 }, 12)).toBe(false);
  });
  it('nothing measured yet: fits', () => {
    expect(fitsCenter({ row: 0, left: 0, right: 0, center: 0 }, 12)).toBe(true);
  });
});
