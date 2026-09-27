// What the settings screen shows about the network: the trusted services of src/net/allowlist.ts, ids and hosts only.
import type { TrustedServiceView } from '../shared/api.ts';
import { TRUSTED_SERVICES, type ServiceId } from '../net/allowlist.ts';

// A new service in TRUSTED_SERVICES must reach the renderer's contract (and its texts) too.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const SERVICE_IDS_MATCH: Same<TrustedServiceView['id'], ServiceId> = true;
void SERVICE_IDS_MATCH;

export function trustedServicesView(): TrustedServiceView[] {
  return TRUSTED_SERVICES.map((s) => ({ id: s.id, hosts: [...s.hosts] }));
}
