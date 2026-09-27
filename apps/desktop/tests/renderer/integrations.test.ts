// Integrations on the screen: whose a new connection is, why a removal did not happen, each bank's forms and texts.
// The Monobank texts are pinned to what the screens said before the bank got its own folder. balanceApi is a fake.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

const { participantChoice, removeText } = await import('@/features/integrations/shared/utils.ts');
const { DEFAULT_PROVIDER, PROVIDER_FORMS } = await import('@/features/integrations/constants.ts');
const { formsOf, isProviderKey, newConnectionTitle } = await import('@/features/integrations/utils.ts');
const { BANKS, MONOBANK, bankOf } = await import('@/entities/bank');
const { ACCESS_NOTE, CONSENT_TEXT, DUPLICATE_TOKEN_TEXT, TOKEN_PLACEHOLDER, TOKEN_STEPS } = await import('@/features/integrations/monobank/constants.ts');

describe('a new connection', () => {
  it('who a new connection is for; why a removal did not happen', () => {
    expect(participantChoice(3, 'ignored', true)).toEqual({ id: 3 });
    expect(participantChoice('new', '  Оля ', false)).toEqual({ label: 'Оля' });
    expect(participantChoice('new', '', true)).toEqual({ fromBank: true });
    expect(participantChoice('new', '   ', false)).toBeNull();
    expect(removeText({ removed: false, reason: 'import-running' })).toMatch(/останови импорт/);
    expect(removeText({ removed: false, reason: 'cancelled' })).toBe('');
    expect(removeText({ removed: true })).toBe('');
  });

  it('a new person carries the chosen colour; an existing one does not', () => {
    expect(participantChoice('new', 'Вигадана', false, 'green')).toEqual({ label: 'Вигадана', color: 'green' });
    expect(participantChoice('new', '', true, 'green')).toEqual({ fromBank: true, color: 'green' });
    expect(participantChoice('new', 'Вигадана', false, null)).toEqual({ label: 'Вигадана' });
    expect(participantChoice(4, '', false, 'green')).toEqual({ id: 4 });
  });
});

describe('banks and their forms', () => {
  it('a bank’s forms by provider; an unknown provider gets the default bank’s', () => {
    expect(isProviderKey('monobank')).toBe(true);
    expect(isProviderKey('privatbank')).toBe(false);
    expect(isProviderKey('toString')).toBe(false);
    expect(formsOf('monobank')).toBe(PROVIDER_FORMS.monobank);
    expect(formsOf('unknown')).toBe(PROVIDER_FORMS.monobank);
  });

  it('every available bank has forms: enabling a bank without them is not a silent no-op click', () => {
    const available = BANKS.filter((b) => b.status === 'available');
    expect(available.length).toBeGreaterThan(0);
    for (const b of available) expect(isProviderKey(b.id), b.id).toBe(true);
  });

  it('the bank entity is display only; Monobank’s token texts live in its folder', () => {
    expect(bankOf('monobank')).toBe(MONOBANK);
    expect(bankOf('unknown')).toBe(MONOBANK);
    expect(MONOBANK).toMatchObject({ id: 'monobank', name: 'Monobank', status: 'available', auth: 'token' });
    for (const b of BANKS) expect(Object.keys(b).filter((k) => k.startsWith('token'))).toEqual([]);
    expect(TOKEN_STEPS[0]).toMatch(/api\.monobank\.ua/);
    expect(TOKEN_PLACEHOLDER).toBe('Токен с api.monobank.ua');
    expect(PROVIDER_FORMS.monobank.accessNote).toBe(ACCESS_NOTE);
  });

  it('the Monobank texts are the same as before the bank got its folder', () => {
    expect(TOKEN_STEPS).toEqual([
      'Открой в браузере api.monobank.ua и войди через приложение Monobank (QR-код).',
      'Скопируй личный токен и вставь его сюда.',
    ]);
    expect(TOKEN_PLACEHOLDER).toEqual('Токен с api.monobank.ua');
    expect(ACCESS_NOTE).toEqual('Токен даёт только чтение выписки и балансов и хранится на этом компьютере.');
    expect(CONSENT_TEXT).toEqual(
      'Токен выпускает сам владелец счетов в своём Monobank и передаёт его тебе. Токен открывает чтение всех его выписок и балансов — добавляй только с его согласия.',
    );
    expect(DUPLICATE_TOKEN_TEXT).toEqual('Этот токен уже подключён.');
    expect(newConnectionTitle(bankOf(DEFAULT_PROVIDER).name)).toEqual('Новое подключение Monobank');
  });
});
