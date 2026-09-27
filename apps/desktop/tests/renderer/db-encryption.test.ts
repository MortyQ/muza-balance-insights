// The «Шифрование базы» card per state (the texts no screen may use: tests/db-encryption-texts.test.ts).
import { describe, expect, it } from 'vitest';
import type { DbStateView } from '@contract/db-state.ts';
import { encryptionText } from '@/features/settings/db-encryption/utils.ts';

const view = (o: Partial<DbStateView>): DbStateView => ({ status: 'ready', encrypted: true, notice: null, platform: 'darwin', ...o });

describe('encryptionText', () => {
  it('encrypted: success, names where the key lives per platform', () => {
    expect(encryptionText(view({}))).toMatchObject({ tone: 'success' });
    expect(encryptionText(view({}))!.text).toContain('Связке ключей');
    expect(encryptionText(view({ platform: 'win32' }))!.text).toContain('DPAPI');
    expect(encryptionText(view({ platform: 'linux' }))!.text).toContain('keyring');
  });

  it('no-secure-storage and encrypt-pending: warnings with their own text', () => {
    const none = encryptionText(view({ encrypted: false, notice: 'no-secure-storage', platform: 'linux' }))!;
    expect(none.tone).toBe('warning');
    expect(none.text).toContain('не зашифрована');
    const pending = encryptionText(view({ encrypted: false, notice: 'encrypt-pending' }))!;
    expect(pending.tone).toBe('warning');
    expect(pending.text).toContain('при следующем запуске');
  });

  it('unknown or not ready: no card', () => {
    expect(encryptionText(null)).toBeNull();
    expect(encryptionText(view({ status: 'key-lost', encrypted: false }))).toBeNull();
  });
});
