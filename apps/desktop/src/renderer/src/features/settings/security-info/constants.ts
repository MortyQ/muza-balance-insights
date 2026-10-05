import type { TrustedServiceView } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** A new trusted service breaks the typecheck here until it has its words. Hosts always come from main. */
export const SERVICE_TEXT = {
  github: { title: 'GitHub', purpose: 'settings.securityInfo.network.github' },
  monobank: { title: 'Monobank', purpose: 'settings.securityInfo.network.monobank' },
  'monobank-rates': { title: 'Monobank', purpose: 'settings.securityInfo.network.monobankRates' },
} as const satisfies Record<TrustedServiceView['id'], { title: string; purpose: MessageKey }>;
