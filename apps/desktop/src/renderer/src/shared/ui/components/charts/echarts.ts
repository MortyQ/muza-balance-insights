// Ours: the only place ECharts is set up. Only what the app draws is registered (bars, a grid, a tooltip, the average
// line, the canvas renderer), from the tree-shaken entry points: the whole `echarts` would bring its map code, which
// builds code from strings, and the prod CSP has no 'unsafe-eval' (tests/echarts-bundle.test.ts).
import { BarChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([BarChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer]);

export { init };
export type { EChartsCoreOption, EChartsType } from "echarts/core";
