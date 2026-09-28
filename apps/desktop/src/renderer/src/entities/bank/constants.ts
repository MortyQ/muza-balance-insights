// Banks on the connect screen. Only Monobank works today; the rest are shown as «Soon». How a bank is connected (token
// steps, forms) lives in its folder in features/integrations.
import type { Bank } from './types.ts';

export const BANKS = [
  {
    id: 'monobank',
    name: 'entities.bank.monobank',
    status: 'available',
    auth: 'token',
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
