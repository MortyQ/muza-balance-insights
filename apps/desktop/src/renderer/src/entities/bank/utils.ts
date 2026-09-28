import { currencyAlpha } from '@mono/core/currency';
import type { AccountName } from '@contract/account-name.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import { t } from '@/shared/lib';
import { BANKS, MONOBANK, MONOBANK_CARD_TYPES } from './constants.ts';
import type { Bank, BankId } from './types.ts';

/**
 * A logo is optional: drop `entities/bank/assets/<id>.svg` (or .png / .webp) and it replaces the monogram at the next build.
 * Local files only — the prod CSP allows images from the app itself and nothing else.
 */
const LOGOS = import.meta.glob('./assets/*.{svg,png,webp}', { eager: true, query: '?url', import: 'default' });

export function bankLogo(id: BankId): string | null {
  const hit = Object.entries(LOGOS).find(([file]) => /\/([^/]+)\.\w+$/.exec(file)?.[1] === id);
  return hit?.[1] ?? null;
}

/** The bank of a connection's provider; one this app does not know (a database from a newer version) shows as Monobank. */
export function bankOf(id: string): Bank {
  return BANKS.find((b) => b.id === id) ?? MONOBANK;
}

/** A card type's name from the bank's table; null type → «Card», a type the table lacks → as the bank sent it. */
export function cardTypeName(type: string | null, cardTypes: Readonly<Record<string, MessageKey>>): string {
  if (type === null) return t('entities.bank.card');
  const key = Object.hasOwn(cardTypes, type) ? cardTypes[type] : undefined;
  return key === undefined ? type : t(key);
}

/**
 * An account on a balance card or in the import line: «Black card · UAH», «Jar · UAH #ab12». Monobank's card names:
 * it is the only bank with accounts today (AccountName carries no provider yet).
 */
export function accountName(n: Readonly<AccountName>): string {
  const kind = n.kind === 'jar' ? t('entities.bank.jar') : cardTypeName(n.type, MONOBANK_CARD_TYPES);
  return `${kind} · ${currencyAlpha(n.currency)}${n.tag === null ? '' : ` #${n.tag}`}`;
}
