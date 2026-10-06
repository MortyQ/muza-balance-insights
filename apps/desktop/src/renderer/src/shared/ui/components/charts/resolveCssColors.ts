/** A string canvas cannot draw as is: a CSS variable or a colour built from one. */
const CSS_COLOR = /^(var|color-mix)\(/;

/**
 * A copy of an ECharts option with every CSS colour (`var(--x)`, `color-mix(…)`) replaced by `resolve(value)`; other
 * values as they are. Arrays and plain objects are walked; functions (formatters) are kept.
 */
export function resolveCssColors<T>(value: T, resolve: (css: string) => string): T {
  if (typeof value === "string") return (CSS_COLOR.test(value) ? resolve(value) : value) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => resolveCssColors(v, resolve)) as T;
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveCssColors(v, resolve)])) as T;
  }
  return value;
}
