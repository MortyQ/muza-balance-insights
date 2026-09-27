// The app header — the window's own title bar (widgets/app-header): layout by OS. Its drag regions are checked in tests/window.test.ts (reads the .vue source).
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { describe, expect, it } from 'vitest';

const { appHeaderLayout } = await import('@/widgets/app-header/utils.ts');

describe('app header layout', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 'mac'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'overlay'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'overlay'],
    ['', 'overlay'],
  ])('appHeaderLayout(%s) → %s', (ua, layout) => expect(appHeaderLayout(ua)).toBe(layout));
});
