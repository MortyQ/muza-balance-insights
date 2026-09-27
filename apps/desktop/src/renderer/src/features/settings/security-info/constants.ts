import type { TrustedServiceView } from '@contract/api.ts';

/** A new trusted service breaks the typecheck here until it has its words. Hosts always come from main. */
export const SERVICE_TEXT = {
  github: { title: 'GitHub', purpose: 'Проверка и загрузка обновлений.' },
  monobank: { title: 'Monobank', purpose: 'Счета и выписка. Токен отправляется только сюда.' },
} as const satisfies Record<TrustedServiceView['id'], { title: string; purpose: string }>;
