import { currencyAlpha } from '@mono/core/shared/currency';
import { PROVIDERS, infoOf } from '@mono/core/providers/info';
import type { AccountName } from '@contract/account-name.ts';
import type { ProviderId } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import { t } from '@/shared/lib';
import { NEUTRAL_MONOGRAM_CLASS, STATEMENT_HINTS } from './constants.ts';
import type { Bank, BankAuth, BankLook } from './types.ts';

/**
 * A logo is optional: drop `entities/bank/assets/<id>.svg` (or .png / .webp) and it replaces the monogram at the next build.
 * Local files only — the prod CSP allows images from the app itself and nothing else.
 */
const LOGOS = import.meta.glob('./assets/*.{svg,png,webp}', { eager: true, query: '?url', import: 'default' });

/** A bank's own monogram: `looks/<id>.ts` exporting `look`. Optional too: without it the bank gets the neutral mark. */
const LOOKS = import.meta.glob<BankLook>('./looks/*.ts', { eager: true, import: 'look' });

const fileId = (file: string) => /\/([^/]+)\.\w+$/.exec(file)?.[1];

export function bankLogo(id: string): string | null {
  const hit = Object.entries(LOGOS).find(([file]) => fileId(file) === id);
  return hit?.[1] ?? null;
}

const neutralLook = (name: string): BankLook => ({ monogram: name.charAt(0).toUpperCase(), monogramClass: NEUTRAL_MONOGRAM_CLASS });

function lookOf(id: string, name: string): BankLook {
  return Object.entries(LOOKS).find(([file]) => fileId(file) === id)?.[1] ?? neutralLook(name);
}

export function isProviderId(id: string): id is ProviderId {
  return Object.hasOwn(PROVIDERS, id);
}

/** The bank of a connection's provider; one the registry does not know (a database from a newer version) shows neutral. */
export function bankOf(id: string): Bank {
  if (!isProviderId(id)) return { id, name: id, ways: [], ...neutralLook(id) };
  const info = infoOf(id);
  const ways: BankAuth[] = [...(info.access.token ? (['token'] as const) : []), ...(info.access.file ? (['file'] as const) : [])];
  return { id, name: info.name, ways, ...lookOf(id, info.name) };
}

/** Every bank of the registry, in its order. */
export const BANKS: ReadonlyArray<Bank> = Object.keys(PROVIDERS).map(bankOf);

/** The provider's card types (accounts.type); none for a bank the registry does not know. */
export function cardTypesOf(provider: string): ReadonlyArray<string> {
  return isProviderId(provider) ? infoOf(provider).cardTypes : [];
}

/** The type a new card from a file starts with; null = the bank names none. */
export function defaultCardTypeOf(provider: string): string | null {
  return isProviderId(provider) ? infoOf(provider).defaultCardType : null;
}

/** A card type's name (`entities.bank.cardType.<provider>.<type>`); a type the bank does not list, or none → «Card». */
export function cardTypeName(provider: string, type: string | null): string {
  if (type === null || !cardTypesOf(provider).includes(type)) return t('entities.bank.card');
  return t(`entities.bank.cardType.${provider}.${type}` as MessageKey);
}

/** An account on a balance card or in the import line: «Black card · UAH», «Jar · UAH #ab12». */
export function accountName(n: Readonly<AccountName>): string {
  const kind = n.kind === 'jar' ? t('entities.bank.jar') : cardTypeName(n.provider, n.type);
  return `${kind} · ${currencyAlpha(n.currency)}${n.tag === null ? '' : ` #${n.tag}`}`;
}

/** Where to download a bank's statement file; a bank without its own hint → the general step. */
export function statementHint(provider: string): string {
  const key = isProviderId(provider) ? STATEMENT_HINTS[provider] : undefined;
  return t(key ?? 'integrations.statement.genericStep1');
}
