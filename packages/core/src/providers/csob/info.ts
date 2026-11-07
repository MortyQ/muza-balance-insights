// ČSOB as the app knows it before any of its code runs: the name, its payment history (a CSV in English; no API is
// used), ids with its prefix, one card type — the export does not name a card or a product.
import type { ProviderInfo } from '../types.ts';

export const csobInfo = {
  id: 'csob',
  name: 'ČSOB',
  access: { token: null, file: true },
  ids: 'prefixed',
  cardTypes: ['card'],
  defaultCardType: 'card',
} as const satisfies ProviderInfo;
