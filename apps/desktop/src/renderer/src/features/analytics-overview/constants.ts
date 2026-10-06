import type { ViewId } from './types.ts';

/** Lines on by default. */
export const DEFAULT_LINES = 5;
/** Within ±12% of the row's usual level a heatmap cell is neutral. */
export const HEAT_EVEN = 0.12;
export const VIEW_IDS: readonly ViewId[] = ['heat', 'small', 'lines', 'compare'];
export const VIEW_ICON: Readonly<Record<ViewId, string>> = {
  heat: 'lucide:grid-3x3',
  small: 'lucide:chart-column',
  lines: 'lucide:chart-spline',
  compare: 'lucide:arrow-left-right',
};
