// Banks on the connect screen. Only Monobank works today; the rest are shown as «Soon». How a bank is connected (token
// steps, forms) lives in its folder in features/integrations.
import type { MessageKey } from '@contract/i18n/index.ts';
import type { Bank } from './types.ts';

export const BANKS = [
  {
    id: 'monobank',
    name: 'entities.bank.monobank',
    status: 'available',
    ways: ['token', 'file'],
    monogram: 'm',
    monogramClass: 'bg-black text-white',
  },
  {
    id: 'privatbank',
    name: 'entities.bank.privatbank',
    status: 'soon',
    // The bank's own letter mark, not a text: the same in every language.
    monogram: 'П',
    monogramClass: 'bg-surface-sunken text-foreground-muted',
  },
  {
    id: 'other',
    name: 'entities.bank.other',
    status: 'soon',
    monogram: '+',
    monogramClass: 'bg-surface-sunken text-foreground-muted',
  },
] as const satisfies ReadonlyArray<Bank>;

export const MONOBANK: Bank = BANKS[0];

/** Monobank's card types → names (balance cards, the import line, «Accounts»); a type not listed shows as the bank sent it. */
export const MONOBANK_CARD_TYPES: Readonly<Record<string, MessageKey>> = {
  black: 'entities.bank.monobankCard.black',
  white: 'entities.bank.monobankCard.white',
  platinum: 'entities.bank.monobankCard.platinum',
  iron: 'entities.bank.monobankCard.iron',
  fop: 'entities.bank.monobankCard.fop',
  yellow: 'entities.bank.monobankCard.yellow',
  eAid: 'entities.bank.monobankCard.eAid',
  madeInUkraine: 'entities.bank.monobankCard.madeInUkraine',
  rebuilding: 'entities.bank.monobankCard.rebuilding',
};
