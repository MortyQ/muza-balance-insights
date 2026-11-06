// Every listed block has its «?» (spec desktop-ui-wording «Blocks say what they count»): read from the sources, since
// the blocks need their whole data to mount. The behaviour of a hint is in tests/renderer/ui-hints.test.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('block hints', () => {
  it('every listed block has its «?» with its own text', () => {
    const SRC = join(import.meta.dirname, '../src/renderer/src');
    const BLOCKS: ReadonlyArray<[string, string]> = [
      ['features/balances/components/BalancesHeader.vue', 'home.balances.help'],
      ['features/balances/components/PacePanel.vue', 'home.balances.pace.help'],
      ['features/now-strip/NowStripFeature.vue', 'home.now.help'],
      ['features/spending-summary/components/SpendingHeader.vue', 'home.spending.help'],
      ['features/home-insights/components/HomeInsightsTile.vue', 'home.insights.help'],
      ['features/analytics-overview/components/FlowChart.vue', 'analytics.help.flow'],
      ['features/analytics-overview/components/ChangesList.vue', 'analytics.help.changes'],
      ['features/analytics-overview/components/CategoryViews.vue', 'analytics.help.views'],
    ];
    for (const [file, key] of BLOCKS) {
      const src = readFileSync(join(SRC, file), 'utf8');
      expect(src, file).toMatch(new RegExp(`<VHelpHint[^>]*>\\{\\{ \\$t\\('${key.replace(/\./g, '\\.')}'\\) \\}\\}</VHelpHint>`));
    }
  });
});
