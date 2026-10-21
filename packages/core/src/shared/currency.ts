// ISO 4217: numeric ↔ alphabetic codes and minor-unit exponents. Monobank sends numeric codes and amounts
// in minor units of the currency's ISO exponent.

const ALPHA_BY_NUMERIC: Readonly<Record<number, string>> = {
  8: 'ALL', 12: 'DZD', 32: 'ARS', 36: 'AUD', 44: 'BSD', 48: 'BHD', 50: 'BDT', 51: 'AMD', 52: 'BBD', 60: 'BMD',
  64: 'BTN', 68: 'BOB', 72: 'BWP', 84: 'BZD', 96: 'BND', 104: 'MMK', 108: 'BIF', 116: 'KHR', 124: 'CAD',
  132: 'CVE', 136: 'KYD', 144: 'LKR', 152: 'CLP', 156: 'CNY', 170: 'COP', 174: 'KMF', 188: 'CRC', 191: 'HRK',
  192: 'CUP', 203: 'CZK', 208: 'DKK', 214: 'DOP', 222: 'SVC', 230: 'ETB', 232: 'ERN', 238: 'FKP', 242: 'FJD',
  262: 'DJF', 270: 'GMD', 292: 'GIP', 320: 'GTQ', 324: 'GNF', 328: 'GYD', 332: 'HTG', 340: 'HNL', 344: 'HKD',
  348: 'HUF', 352: 'ISK', 356: 'INR', 360: 'IDR', 364: 'IRR', 368: 'IQD', 376: 'ILS', 388: 'JMD', 392: 'JPY',
  398: 'KZT', 400: 'JOD', 404: 'KES', 408: 'KPW', 410: 'KRW', 414: 'KWD', 417: 'KGS', 418: 'LAK', 422: 'LBP',
  426: 'LSL', 430: 'LRD', 434: 'LYD', 446: 'MOP', 454: 'MWK', 458: 'MYR', 462: 'MVR', 480: 'MUR', 484: 'MXN',
  496: 'MNT', 498: 'MDL', 504: 'MAD', 512: 'OMR', 516: 'NAD', 524: 'NPR', 532: 'ANG', 533: 'AWG', 548: 'VUV',
  554: 'NZD', 558: 'NIO', 566: 'NGN', 578: 'NOK', 586: 'PKR', 590: 'PAB', 598: 'PGK', 600: 'PYG', 604: 'PEN',
  608: 'PHP', 634: 'QAR', 643: 'RUB', 646: 'RWF', 654: 'SHP', 682: 'SAR', 690: 'SCR', 694: 'SLL', 702: 'SGD',
  704: 'VND', 706: 'SOS', 710: 'ZAR', 728: 'SSP', 748: 'SZL', 752: 'SEK', 756: 'CHF', 760: 'SYP', 764: 'THB',
  776: 'TOP', 780: 'TTD', 784: 'AED', 788: 'TND', 800: 'UGX', 807: 'MKD', 818: 'EGP', 826: 'GBP', 834: 'TZS',
  840: 'USD', 858: 'UYU', 860: 'UZS', 882: 'WST', 886: 'YER', 901: 'TWD', 925: 'SLE', 928: 'VES', 929: 'MRU',
  930: 'STN', 933: 'BYN', 934: 'TMT', 936: 'GHS', 941: 'RSD', 943: 'MZN', 944: 'AZN', 946: 'RON', 947: 'CHE',
  949: 'TRY', 950: 'XAF', 951: 'XCD', 952: 'XOF', 953: 'XPF', 967: 'ZMW', 968: 'SRD', 969: 'MGA', 971: 'AFN',
  972: 'TJS', 973: 'AOA', 975: 'BGN', 976: 'CDF', 977: 'BAM', 978: 'EUR', 980: 'UAH', 981: 'GEL', 985: 'PLN',
  986: 'BRL',
};

const NUMERIC_BY_ALPHA: ReadonlyMap<string, number> = new Map(
  Object.entries(ALPHA_BY_NUMERIC).map(([n, a]) => [a, Number(n)]),
);

/** Currencies whose minor unit is not 1/100. */
const EXPONENT: Readonly<Record<string, number>> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0,
  XAF: 0, XOF: 0, XPF: 0, BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

/** ISO 4217 numeric → alphabetic code; unknown codes stay numeric (as a string). */
export function currencyAlpha(code: number): string {
  return ALPHA_BY_NUMERIC[code] ?? String(code);
}

/** Alphabetic (any case) or numeric string → numeric code; null if unknown. */
export function currencyNumeric(code: string): number | null {
  const c = code.trim().toUpperCase();
  if (/^\d{1,3}$/.test(c)) return Number(c);
  return NUMERIC_BY_ALPHA.get(c) ?? null;
}

export function currencyExponent(code: number): number {
  return EXPONENT[currencyAlpha(code)] ?? 2;
}

/** Minor units → major units as a number (1234.56), by the currency's exponent, via integer arithmetic. */
export function toMajor(minor: number, code: number): number {
  if (!Number.isSafeInteger(minor)) throw new RangeError('Сумма должна быть целым числом в минимальных единицах');
  const exp = currencyExponent(code);
  if (exp === 0) return minor;
  const div = 10 ** exp;
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return Number(`${sign}${Math.trunc(abs / div)}.${String(abs % div).padStart(exp, '0')}`);
}
