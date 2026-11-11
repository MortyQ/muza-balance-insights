import type { AppCurrency, AppCurrencyKey } from '@contract/currencies.ts';

/** The home screen's main currency (every amount is shown in it) and the «≈» currencies next to it. */
export interface CurrencyChoice {
  main: AppCurrency;
  also: Record<AppCurrencyKey, boolean>;
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
  /** The same currencies as numbers: minor units of each, in `approx` order. */
  alsoParts(kopecks: number): Array<{ currency: number; minor: number }>;
  /** The picked «also» currencies shown (each with a rate, never the main one), in menu order. */
  alsoCurrencies: ReadonlyArray<number>;
  /**
   * The «also» lines of one operation: a picked currency the operation is known in (its own amount, or its account's)
   * is that exact amount, without «≈»; any other is `approx`. Amounts are absolute.
   */
  alsoFor(kopecks: number, exact: ReadonlyArray<{ amount: number; currency: number }>): string[];
  /** Whether `currency` already shows on screen: the main one or a picked «also» one. */
  shows(currency: number): boolean;
}
