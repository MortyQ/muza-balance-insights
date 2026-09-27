// The settings screen lists the hosts the app may reach: exactly TRUSTED_SERVICES, ids and hosts only.
import { describe, expect, it } from 'vitest';
import { trustedServicesView } from '../src/main/services.ts';
import { TRUSTED_SERVICES } from '../src/net/allowlist.ts';

describe('trustedServicesView', () => {
  it('mirrors TRUSTED_SERVICES: ids and hosts only, no purpose', () => {
    expect(trustedServicesView()).toEqual(TRUSTED_SERVICES.map((s) => ({ id: s.id, hosts: [...s.hosts] })));
    for (const v of trustedServicesView()) expect(Object.keys(v).sort()).toEqual(['hosts', 'id']);
  });
});
