/** The home screen's main currency (every amount is shown in it) and the «≈» currencies next to it. */
export type MainCurrency = 980 | 840 | 978;
export type CurrencyKey = 'uah' | 'usd' | 'eur';
export interface CurrencyChoice {
  main: MainCurrency;
  also: Record<CurrencyKey, boolean>;
}

/** Every home amount goes through this: hryvnia kopecks in, the main currency's text out. */
export interface MoneyFormat {
  /** The currency on screen: the chosen main one, or hryvnia while it has no rate. */
  currency: number;
  /** Hryvnia kopecks → minor units of `currency`. */
  convert(kopecks: number): number;
  money(kopecks: number): string;
  /** «≈ 100 $» per picked «also» currency that has a rate (never the main one). */
  approx(kopecks: number): string[];
  /** The same on one line: «≈ 100 $ · 80 €»; '' — none. */
  approxInline(kopecks: number): string;
}
