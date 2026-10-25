// PrivatBank as the app knows it before any of its code runs: the name, its Privat24 card statement file (no API for a
// personal card), ids with its prefix, one card type — the statement does not name the card's product.
import type { ProviderInfo } from '../types.ts';

export const privatbankInfo = {
  id: 'privatbank',
  name: 'PrivatBank',
  access: { token: null, file: true },
  ids: 'prefixed',
  cardTypes: ['card'],
  defaultCardType: 'card',
} as const satisfies ProviderInfo;
