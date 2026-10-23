// Monobank as the app knows it before any of its code runs: the name, a token for its personal API or its card
// statement file, ids as the bank sends them, the card types it names (accounts.type).
import type { ProviderInfo } from '../types.ts';
import { MAX_STATEMENT_WINDOW_SEC, RATE_LIMIT_MS } from './constants.ts';

export const monobankInfo = {
  id: 'monobank',
  name: 'Monobank',
  access: {
    token: {
      credential: /^\S{20,200}$/,
      api: { origin: 'https://api.monobank.ua', requestIntervalMs: RATE_LIMIT_MS, maxWindowSec: MAX_STATEMENT_WINDOW_SEC },
    },
    file: true,
  },
  // Stored before ids carried a provider: its ids never hold «:», so a prefixed id of another bank cannot equal one.
  ids: 'bare',
  cardTypes: ['black', 'white', 'platinum', 'iron', 'fop', 'yellow', 'eAid', 'madeInUkraine', 'rebuilding'],
  defaultCardType: 'black',
} as const satisfies ProviderInfo;
