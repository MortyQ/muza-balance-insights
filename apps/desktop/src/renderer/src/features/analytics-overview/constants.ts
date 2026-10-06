import { COLORED } from '@/entities/category';
import type { ViewId } from './types.ts';

/** Rows the views show by name (one rank colour each); the rest is one «Other N» row. */
export const TOP_ROWS = COLORED;
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
