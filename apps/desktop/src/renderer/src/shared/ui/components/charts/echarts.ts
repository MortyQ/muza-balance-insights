// Ours: the only place ECharts is set up. Only what the app draws is registered (bars, lines, a pie for the spending
// ring, a custom polygon series for the area between income and spending, a grid, a tooltip, the average line, a
// shaded range, the canvas renderer), from the tree-shaken entry points: the whole `echarts` would bring its map code,
// which builds code from strings, and the prod CSP has no 'unsafe-eval' (tests/echarts-bundle.test.ts).
import { BarChart, CustomChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([BarChart, LineChart, PieChart, CustomChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, CanvasRenderer]);

export { init };
export type { EChartsCoreOption, EChartsType } from "echarts/core";
