// What the desktop app knows about each bank provider outside the core: the shape of its credential, checked before
// anything is stored or sent to the worker. Every provider of the core has an entry (tests/providers.test.ts). The
// services its import may reach are the worker's table (src/worker/import.ts), written out literally.
import type { ProviderId } from '@mono/core/providers/types';

export interface DesktopProvider {
  /** Name in the UI. */
  bank: string;
  /** A credential-shaped string; nothing else is kept. */
  credential: RegExp;
}

export const DESKTOP_PROVIDERS = {
  monobank: { bank: 'Monobank', credential: /^\S{20,200}$/ },
} as const satisfies Record<ProviderId, DesktopProvider>;
