// The banks with an API, the desktop's side: the trusted service each one's import may reach. Each bank's entry lives
// in its folder (src/integrations/<bank>/desktop.ts); exactly the core's token providers have one (the type and
// tests/providers.test.ts). The name and the credential shape are the core's (providers/info.ts).
import type { TokenProviderId } from '@mono/core/providers/info';
import { monobank } from '../integrations/monobank/desktop.ts';
import type { DesktopProvider } from '../integrations/types.ts';

export const DESKTOP_PROVIDERS = {
  monobank,
} as const satisfies Record<TokenProviderId, DesktopProvider>;
