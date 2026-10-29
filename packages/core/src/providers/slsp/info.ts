// Slovenská sporiteľňa as the app knows it before any of its code runs: the name, its monthly account statement (a
// PDF in Slovak; no API is used), ids with its prefix, one card type — the statement does not name the product.
import type { ProviderInfo } from '../types.ts';

export const slspInfo = {
  id: 'slsp',
  name: 'Slovenská sporiteľňa',
  access: { token: null, file: true },
  ids: 'prefixed',
  cardTypes: ['card'],
  defaultCardType: 'card',
} as const satisfies ProviderInfo;
