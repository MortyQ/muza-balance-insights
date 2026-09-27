// Monobank's bank-generated description texts, observed in real data. They name no person or merchant and are
// compared after trim. Extend only from real data, never from guesses about the API.

/** Jar-side auto top-ups triggered by a purchase (percentage / rounding rules). */
export const AUTO_TOPUP_DESCRIPTIONS: ReadonlySet<string> = new Set(['10%', 'До 10₴', 'До 100₴']);

/**
 * Transfers between the user's own cards, FOP accounts and jars, as each side describes them, with the other side each
 * text names: the account type and, where the text says it, the currency.
 */
export const OWN_TRANSFER_COUNTERPART: ReadonlyMap<string, { type: string; currencyCode: number | null }> = new Map([
  ['З Чорної картки', { type: 'black', currencyCode: null }],
  ['На чорну картку', { type: 'black', currencyCode: null }],
  ['З Білої картки', { type: 'white', currencyCode: null }],
  ['На білу картку', { type: 'white', currencyCode: null }],
  ['З гривневого рахунку ФОП', { type: 'fop', currencyCode: 980 }],
  ['З доларового рахунку ФОП для переказу на картку', { type: 'fop', currencyCode: 840 }],
  ['На гривневий рахунок ФОП для переказу на картку', { type: 'fop', currencyCode: 980 }],
]);

export const OWN_TRANSFER_DESCRIPTIONS: ReadonlySet<string> = new Set(OWN_TRANSFER_COUNTERPART.keys());

/** White card's outgoing transfer text: used for own cards AND possibly for other people's — never text-matched. */
export const GENERIC_TRANSFER_DESCRIPTION = 'Переказ на картку';

/** Installment / credit payment. A service string, but not a transfer. */
export const INSTALLMENT_DESCRIPTION = 'Щомісячний платіж';

export const SERVICE_EXACT: ReadonlySet<string> = new Set([
  ...AUTO_TOPUP_DESCRIPTIONS,
  ...OWN_TRANSFER_DESCRIPTIONS,
  GENERIC_TRANSFER_DESCRIPTION,
  INSTALLMENT_DESCRIPTION,
]);

/** Card-side jar operations: "<prefix> «<jar title>»". The title is always replaced. */
const JAR_TEMPLATE_PREFIXES: readonly string[] = [
  'Округлення балансу',
  'Регулярне поповнення',
  'Часткове зняття банки',
];
export const JAR_TEMPLATE = new RegExp(`^(${JAR_TEMPLATE_PREFIXES.join('|')}) «.*»$`, 's');
/** The jar title inside a card-side jar template, or null. */
export function jarTemplateTitle(raw: string): string | null {
  const m = new RegExp(`^(?:${JAR_TEMPLATE_PREFIXES.join('|')}) «(.*)»$`, 's').exec(raw.trim());
  return m?.[1]?.trim() || null;
}

/**
 * A bank-generated description of money moving between the user's own accounts.
 * `Щомісячний платіж` is excluded (not a transfer); `Переказ на картку` only with includeGeneric.
 */
export function isTransferServiceDescription(
  raw: string,
  jarTitles: ReadonlySet<string>,
  opts: { includeGeneric: boolean },
): boolean {
  const text = raw.trim();
  if (AUTO_TOPUP_DESCRIPTIONS.has(text) || OWN_TRANSFER_DESCRIPTIONS.has(text)) return true;
  if (JAR_TEMPLATE.test(text) || jarTitles.has(text)) return true;
  return opts.includeGeneric && text === GENERIC_TRANSFER_DESCRIPTION;
}

/** «ГУК …» — a state treasury account (observed: tax payments made as transfers). */
export function isTreasuryDescription(raw: string): boolean {
  return raw.trim().startsWith('ГУК');
}

/** «Від: …» — an incoming transfer from a named sender (never a refund). */
export function isFromPrefixDescription(raw: string): boolean {
  return raw.trim().startsWith('Від:');
}
