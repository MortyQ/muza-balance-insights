// Stored ids: where a bank's account or operation id becomes the id it is stored under, so two banks never collide.
// A 'prefixed' provider's ids carry `<provider>:`; a 'bare' one's (Monobank's) are stored as the bank sends them —
// they contain no `:`, so they can never equal a prefixed id. Applied where ids enter storage (ingest/), and nowhere
// else: statement row ids derive from the stored account id and inherit the prefix.
import { infoOf } from './info.ts';
import type { ProviderId } from './types.ts';

/** The id a bank's account or operation id is stored under. */
export function storedId(provider: ProviderId, bankId: string): string {
  return infoOf(provider).ids === 'bare' ? bankId : `${provider}:${bankId}`;
}

/** The bank's id of a stored account id, for the provider's client; a stored id without the prefix is an error. */
export function bankIdOf(provider: ProviderId, stored: string): string {
  if (infoOf(provider).ids === 'bare') return stored;
  const prefix = `${provider}:`;
  if (!stored.startsWith(prefix)) throw new Error(`Account ${stored} is not an id of ${provider}`);
  return stored.slice(prefix.length);
}
