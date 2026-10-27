// A-Bank (Akcent-Bank) as the app knows it before any of its code runs: the name, its card statement file (.xlsx or
// .pdf; no API for a personal card), ids with its prefix, one card type — the statement does not name the product.
import type { ProviderInfo } from '../types.ts';

export const abankInfo = {
  id: 'abank',
  name: 'A-Bank',
  access: { token: null, file: true },
  ids: 'prefixed',
  cardTypes: ['card'],
  defaultCardType: 'card',
} as const satisfies ProviderInfo;
