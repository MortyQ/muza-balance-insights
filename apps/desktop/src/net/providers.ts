// What the desktop app knows about each bank provider outside the core: the shape of its credential (checked before
// anything is stored) and the trusted services its import may reach (allowlist.ts). Every provider of the core has an
// entry (tests/providers.test.ts).
import type { ProviderId } from '@mono/core/providers/types';
import type { ServiceId } from './allowlist.ts';

export interface DesktopProvider {
  /** Name in the UI. */
  bank: string;
  /** A credential-shaped string; nothing else is kept. */
  credential: RegExp;
  services: ReadonlyArray<ServiceId>;
}

export const DESKTOP_PROVIDERS = {
  monobank: { bank: 'Monobank', credential: /^\S{20,200}$/, services: ['monobank'] },
} as const satisfies Record<ProviderId, DesktopProvider>;
