// Description masking for the analysis copy (analysis/analysis.sqlite).
// Only service strings observed in real data survive verbatim; everything else becomes '[other]'.
// Extend these lists only from real data, never from guesses about the API.

export const JAR_PLACEHOLDER = '[jar]';
export const OTHER_PLACEHOLDER = '[other]';

// All lists below are bank-generated descriptions observed in real data; they name no person or
// merchant and are compared after trim. src/transfers.ts reuses them for the text fallback.

/** Jar-side auto top-ups triggered by a purchase (percentage / rounding rules). */
export const AUTO_TOPUP_DESCRIPTIONS: ReadonlySet<string> = new Set(['10%', 'До 10₴', 'До 100₴']);

/** Transfers between the user's own cards, FOP accounts and jars, as each side describes them. */
export const OWN_TRANSFER_DESCRIPTIONS: ReadonlySet<string> = new Set([
  'З Чорної картки',
  'З Білої картки',
  'На білу картку',
  'На чорну картку',
  'З гривневого рахунку ФОП',
  'З доларового рахунку ФОП для переказу на картку',
  'На гривневий рахунок ФОП для переказу на картку',
]);

/** White card's outgoing transfer text: used for own cards AND possibly for other people's — never text-matched. */
export const GENERIC_TRANSFER_DESCRIPTION = 'Переказ на картку';

/** Installment / credit payment. A service string, but not a transfer. */
export const INSTALLMENT_DESCRIPTION = 'Щомісячний платіж';

const SERVICE_EXACT: ReadonlySet<string> = new Set([
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
const JAR_TEMPLATE = new RegExp(`^(${JAR_TEMPLATE_PREFIXES.join('|')}) «.*»$`, 's');

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

export type DescClass = 'service' | 'card_pan' | 'from_prefix' | 'treasury' | 'other';

export type MaskedDescription = { description: string; descClass: DescClass };

/**
 * @param jarTitles titles of the user's jars: a description equal to one of them is a jar top-up
 *   seen from the card side and becomes '[jar]'.
 */
export function maskDescription(raw: string, jarTitles: ReadonlySet<string>): MaskedDescription {
  const text = raw.trim();
  if (SERVICE_EXACT.has(text)) return { description: text, descClass: 'service' };

  const template = JAR_TEMPLATE.exec(text);
  if (template) return { description: `${template[1]} «${JAR_PLACEHOLDER}»`, descClass: 'service' };

  if (jarTitles.has(text)) return { description: JAR_PLACEHOLDER, descClass: 'service' };

  // Shape-only classes: the text itself is never kept.
  return { description: OTHER_PLACEHOLDER, descClass: classifyShape(text) };
}

function classifyShape(text: string): DescClass {
  if (/^\d{6}\*+\d{4}$/.test(text)) return 'card_pan';
  if (isFromPrefixDescription(text)) return 'from_prefix';
  if (isTreasuryDescription(text)) return 'treasury';
  return 'other';
}

/** «ГУК …» — a state treasury account (observed: tax payments made as transfers). */
export function isTreasuryDescription(raw: string): boolean {
  return raw.trim().startsWith('ГУК');
}

/** «Від: …» — an incoming transfer from a named sender (never a refund). */
export function isFromPrefixDescription(raw: string): boolean {
  return raw.trim().startsWith('Від:');
}
