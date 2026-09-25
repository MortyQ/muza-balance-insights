// Banks on the connect screen. Only Monobank works today; the rest are shown as «Скоро». The connection itself
// (setToken / clearToken in main) is Monobank-only until a second bank exists.
import type { Bank } from './types.ts';

export const BANKS = [
  {
    id: 'monobank',
    name: 'Monobank',
    status: 'available',
    monogram: 'm',
    monogramClass: 'bg-black text-white',
    tokenSteps: [
      'Открой в браузере api.monobank.ua и войди через приложение Monobank (QR-код).',
      'Скопируй личный токен и вставь его сюда.',
    ],
    tokenPlaceholder: 'Токен с api.monobank.ua',
  },
  {
    id: 'privatbank',
    name: 'ПриватБанк',
    status: 'soon',
    monogram: 'П',
    monogramClass: 'bg-surface-sunken text-foreground-muted',
    tokenSteps: [],
    tokenPlaceholder: '',
  },
  {
    id: 'other',
    name: 'Другие банки',
    status: 'soon',
    monogram: '+',
    monogramClass: 'bg-surface-sunken text-foreground-muted',
    tokenSteps: [],
    tokenPlaceholder: '',
  },
] as const satisfies ReadonlyArray<Bank>;

export const MONOBANK: Bank = BANKS[0];
