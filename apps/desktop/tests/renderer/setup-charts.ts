// Renderer tests run without a canvas: ECharts is replaced by a recorder. A test reads what a chart was given from
// `chartCalls` (the latest option per chart) instead of pixels.
import { vi } from 'vitest';

export type FakeChart = { el: HTMLElement; options: unknown[]; disposed: boolean };
export const chartCalls: FakeChart[] = [];

vi.mock('@/shared/ui/components/charts/echarts.ts', () => ({
  init: (el: HTMLElement) => {
    const c: FakeChart = { el, options: [], disposed: false };
    chartCalls.push(c);
    return { setOption: (o: unknown) => c.options.push(o), resize: () => undefined, dispose: () => (c.disposed = true) };
  },
}));
