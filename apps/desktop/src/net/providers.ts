// What the desktop app knows about each bank provider outside the core: the shape of its credential, checked before
// anything is stored or sent to the worker. Each bank's entry lives in its folder (src/integrations/<bank>/desktop.ts);
// every provider of the core has one (tests/providers.test.ts). The services its import may reach are the worker's
// table (src/worker/import.ts), written out literally.
import type { ProviderId } from '@mono/core/providers/types';
import { monobank } from '../integrations/monobank/desktop.ts';
import type { DesktopProvider } from '../integrations/types.ts';

export const DESKTOP_PROVIDERS = {
  monobank,
} as const satisfies Record<ProviderId, DesktopProvider>;
