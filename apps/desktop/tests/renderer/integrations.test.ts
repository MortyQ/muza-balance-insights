// Integrations on the screen: whose a new connection is, why a removal did not happen, each bank's forms and texts,
// the accounts of «Счета» (labels, the toggle and what it refreshes).
// The Monobank texts are pinned to what the screens said before the bank got its own folder. balanceApi is a fake.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionAccountView, SetAccountEnabledResult } from '@contract/api.ts';

const api = vi.hoisted(() => ({
  listPeople: vi.fn(async () => ({ people: [], secureStorage: true })),
  getSyncStatus: vi.fn(async () => ({ hasData: true, dataUntil: null, dataFrom: null, lastSyncAt: null })),
  listConnectionAccounts: vi.fn(async (_id: number): Promise<ConnectionAccountView[]> => []),
  setAccountEnabled: vi.fn(async (_id: string, _on: boolean): Promise<SetAccountEnabledResult> => ({ changed: true })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: api }));

const { accountLabel, accountSwitchChange, accountToggleText, accountsButtonText, participantChoice, removeText } = await import('@/features/integrations/shared/utils.ts');
const { useConnectionActions } = await import('@/features/integrations/shared/composables/useConnectionActions.ts');
const { useSyncStatusStore } = await import('@/entities/sync-status');
const { CARD_TYPE_NAMES } = await import('@/features/integrations/monobank/constants.ts');
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

const account = (o: Partial<ConnectionAccountView> = {}): ConnectionAccountView => ({
  id: 'a1', kind: 'card', type: 'black', currencyCode: 980, maskedPanTail: '1234', jarTitle: null, enabled: true, auto: true, ...o,
});

describe('«Счета» of a connection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('an account’s label: card type · currency · last digits; a jar by its title', () => {
    expect(accountLabel(account(), CARD_TYPE_NAMES)).toBe('Чёрная карта · UAH · •• 1234');
    expect(accountLabel(account({ type: 'white', currencyCode: 840, maskedPanTail: null }), CARD_TYPE_NAMES)).toBe('Белая карта · USD');
    expect(accountLabel(account({ type: 'fop' }), CARD_TYPE_NAMES)).toBe('Счёт ФОП · UAH · •• 1234');
    expect(accountLabel(account({ type: 'madeInUkraine' }), CARD_TYPE_NAMES)).toBe('Национальный кешбэк · UAH · •• 1234');
    // An unknown type shows as the bank sent it; an inherited key is not a name.
    expect(accountLabel(account({ type: 'newKind' }), CARD_TYPE_NAMES)).toBe('newKind · UAH · •• 1234');
    expect(accountLabel(account({ type: 'toString' }), CARD_TYPE_NAMES)).toBe('toString · UAH · •• 1234');
    expect(accountLabel(account({ type: null }), CARD_TYPE_NAMES)).toBe('Карта · UAH · •• 1234');
    expect(accountLabel(account({ kind: 'jar', type: null, maskedPanTail: null, jarTitle: ' Відпустка ' }), CARD_TYPE_NAMES)).toBe('Банка «Відпустка» · UAH');
    expect(accountLabel(account({ kind: 'jar', type: null, maskedPanTail: null, jarTitle: null, currencyCode: 978 }), CARD_TYPE_NAMES)).toBe('Банка · EUR');
    expect(accountToggleText({ changed: true })).toBe('');
    expect(accountToggleText({ changed: false, reason: 'import-running' })).toMatch(/после него/);
  });

  it('the «Счета» button: all counted, or how many of all', () => {
    expect(accountsButtonText({ accounts: 3, enabledAccounts: 3 })).toBe('Счета · 3');
    expect(accountsButtonText({ accounts: 3, enabledAccounts: 1 })).toBe('Счета · 1 из 3');
    expect(accountsButtonText({ accounts: 2, enabledAccounts: 0 })).toBe('Счета · 0 из 2');
  });

  it('a switch: saved value, rollback after a refusal; while another saves it goes back at once', () => {
    // The browser has already flipped the input when @change fires.
    const input = { checked: false };
    const change = accountSwitchChange(input, true, false);
    expect(change?.enabled).toBe(false);
    change?.done(false); // refused (import running) or failed
    expect(input.checked).toBe(true);

    const ok = { checked: false };
    accountSwitchChange(ok, true, false)?.done(true);
    expect(ok.checked).toBe(false);

    const other = { checked: true };
    expect(accountSwitchChange(other, false, true)).toBeNull();
    expect(other.checked).toBe(false);
  });

  it('every Monobank type the database knows has a name', () => {
    for (const t of ['black', 'white', 'platinum', 'iron', 'fop', 'yellow', 'eAid']) expect(CARD_TYPE_NAMES[t], t).toBeTruthy();
  });

  it('loads the list on open; a toggle updates the row and refreshes people and the data status', async () => {
    api.listConnectionAccounts.mockResolvedValueOnce([account(), account({ id: 'j1', kind: 'jar', type: null, jarTitle: 'Банка' })]);
    const a = useConnectionActions();
    const syncStatus = useSyncStatusStore();
    await a.loadAccounts(7);
    expect(api.listConnectionAccounts).toHaveBeenCalledWith(7);
    const state = a.accounts.value.get(7);
    expect(state?.status === 'ready' && state.accounts.map((x) => x.id)).toEqual(['a1', 'j1']);

    const version = syncStatus.version;
    expect(await a.setAccountEnabled(7, 'a1', false)).toBe(true);
    expect(api.setAccountEnabled).toHaveBeenCalledWith('a1', false);
    const after = a.accounts.value.get(7);
    expect(after?.status === 'ready' && after.accounts[0]).toMatchObject({ id: 'a1', enabled: false, auto: false });
    expect(api.listPeople).toHaveBeenCalledTimes(1);
    expect(syncStatus.version).toBe(version + 1);
    expect(a.error.value).toBe('');
    expect(a.savingAccount.value).toBeNull();
  });

  it('refused while an import runs, or failed: the row stays, the message goes to the section', async () => {
    api.listConnectionAccounts.mockResolvedValueOnce([account()]);
    const a = useConnectionActions();
    await a.loadAccounts(7);

    api.setAccountEnabled.mockResolvedValueOnce({ changed: false, reason: 'import-running' });
    expect(await a.setAccountEnabled(7, 'a1', false)).toBe(false);
    expect(a.error.value).toMatch(/Идёт импорт/);
    const kept = a.accounts.value.get(7);
    expect(kept?.status === 'ready' && kept.accounts[0]?.enabled).toBe(true);
    expect(api.listPeople).not.toHaveBeenCalled();

    api.setAccountEnabled.mockRejectedValueOnce(new Error('ipc'));
    expect(await a.setAccountEnabled(7, 'a1', false)).toBe(false);
    expect(a.error.value).toMatch(/Не удалось выполнить/);
    expect(a.savingAccount.value).toBeNull();
  });

  it('a failed list load is logged (the error only) for the next report', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const a = useConnectionActions();
    const e = new Error("Error invoking remote method 'balance:listConnectionAccounts'");
    api.listConnectionAccounts.mockRejectedValueOnce(e);
    await a.loadAccounts(5);
    expect(log).toHaveBeenCalledWith('[accounts] list failed', e);
    log.mockRestore();
  });

  it('a failed list load is an error state; a reopen keeps the old list while the new one comes', async () => {
    const a = useConnectionActions();
    api.listConnectionAccounts.mockRejectedValueOnce(new Error('ipc'));
    await a.loadAccounts(3);
    expect(a.accounts.value.get(3)).toEqual({ status: 'error' });

    api.listConnectionAccounts.mockResolvedValueOnce([account()]);
    await a.loadAccounts(3);
    let release: (v: ConnectionAccountView[]) => void = () => undefined;
    api.listConnectionAccounts.mockReturnValueOnce(new Promise((r) => (release = r)));
    const reload = a.loadAccounts(3);
    expect(a.accounts.value.get(3)?.status).toBe('ready');
    release([account({ enabled: false })]);
    await reload;
    const s = a.accounts.value.get(3);
    expect(s?.status === 'ready' && s.accounts[0]?.enabled).toBe(false);
  });
});
