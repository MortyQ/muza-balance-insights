// People on the screen: the participant store (family / one person, remembered choice), which screen opens, the
// notices about missing tokens, the lines about connections that did not import. balanceApi is a fake; fictional names.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionView, PeopleView, PersonView, TokenStatus } from '@contract/api.ts';

const api = vi.hoisted(() => {
  // The tests run in node: a minimal localStorage (the store only uses getItem / setItem).
  const items = new Map<string, string>();
  const storage = {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    clear: () => items.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  return { people: null as PeopleView | null };
});
vi.mock('@/shared/api', () => ({ balanceApi: { listPeople: vi.fn(async () => api.people) } }));

const { FAMILY, allAccountsOff, colorHolders, colorVar, coverageLine, filterOptions, firstFreeColor, tokenBadge, tokenLine, useParticipantStore } = await import('@/entities/participant');
const { startRoute } = await import('@/app/router/startRoute.ts');
const { noTokenText } = await import('@/widgets/home-notices/utils.ts');
const { failureLines, progressLine } = await import('@/features/import-statement/utils.ts');
const { connectionsCount } = await import('@/features/settings/people/utils.ts');

const token = (o: Partial<TokenStatus> = {}): TokenStatus => ({ present: true, stored: 'secure', secureStorage: true, needsReentry: false, ...o });
const conn = (id: number, o: Partial<ConnectionView> = {}): ConnectionView => ({
  id, provider: 'monobank', bank: 'Monobank', accounts: 2, enabledAccounts: 2, coveredFrom: null, coveredTo: null, lastSyncAt: null, token: token(), ...o,
});
const person = (id: number, label: string, connections: ConnectionView[]): PersonView => ({ id, label, labelFromBank: false, color: null, connections });

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('participant store', () => {
  it('one person: no switch, always that person (no «Вся семья» repeating their card)', async () => {
    api.people = { people: [person(1, 'Я', [conn(1)])], secureStorage: true };
    localStorage.setItem('balance.participant', String(FAMILY));
    const s = useParticipantStore();
    expect(s.selectedId).toBeNull();
    await s.refresh();
    expect([s.multiple, s.selectedId, s.hasConnections, s.anyToken]).toEqual([false, 1, true, true]);
  });

  it('two people: the choice is remembered; a person that is gone falls back to the family', async () => {
    api.people = { people: [person(1, 'Я', [conn(1)]), person(2, 'Вигадана', [conn(2, { token: token({ present: false, stored: null }) })])], secureStorage: true };
    const s = useParticipantStore();
    await s.refresh();
    expect([s.multiple, s.selectedId]).toEqual([true, null]);
    s.select(2);
    expect(s.selectedId).toBe(2);
    expect(localStorage.getItem('balance.participant')).toBe('2');
    expect(s.withoutToken.map((c) => c.id)).toEqual([2]);
    expect(s.labelOf(2)).toBe('Вигадана · Monobank');

    setActivePinia(createPinia());
    const again = useParticipantStore();
    await again.refresh();
    expect(again.selectedId).toBe(2);

    api.people = { people: [person(1, 'Я', [conn(1)]), person(3, 'Інша', [conn(3)])], secureStorage: true };
    await again.refresh();
    expect(again.selectedId).toBeNull();
    again.select(FAMILY);
    expect(again.selectedId).toBeNull();
  });

  it('rows: token and coverage lines', () => {
    expect(tokenLine(token())).toMatch(/системном хранилище/);
    expect(tokenLine(token({ present: false, stored: null, needsReentry: true }))).toMatch(/больше не читается/);
    expect(coverageLine(conn(1))).toBe('Ещё не загружено');
    expect(coverageLine(conn(1, { coveredFrom: '2025-06-01', coveredTo: '2026-09-25' }))).toBe('Счетов: 2 · загружено с 01.06.2025 по 25.09.2026');
    // Some accounts off: how many count, of all.
    expect(coverageLine(conn(1, { accounts: 3, coveredFrom: '2025-06-01', coveredTo: '2026-09-25' }))).toBe('Счетов: 2 из 3 · загружено с 01.06.2025 по 25.09.2026');
    // All off: no coverage of enabled accounts, but it is not «not imported».
    expect(coverageLine(conn(1, { enabledAccounts: 0 }))).toBe('Все счета выключены');
    expect(coverageLine(conn(1, { enabledAccounts: 0, coveredFrom: '2025-06-01', coveredTo: '2026-09-25' }))).toBe('Все счета выключены');
    expect(coverageLine(conn(1, { accounts: 0, enabledAccounts: 0 }))).toBe('Ещё не загружено');
  });
});

describe('token badge in settings', () => {
  it.each([
    [token(), 'success', 'Токен сохранён'],
    [token({ stored: 'memory' }), 'warning', 'Токен до закрытия'],
    [token({ present: false, stored: null, needsReentry: true }), 'warning', 'Введи токен заново'],
    [token({ present: false, stored: null }), 'warning', 'Нужен токен'],
  ])('tokenBadge %#', (s, tone, text) => expect(tokenBadge(s)).toEqual({ tone, text }));

  it.each([
    [0, '0 подключений'],
    [1, '1 подключение'],
    [2, '2 подключения'],
    [5, '5 подключений'],
    [11, '11 подключений'],
    [21, '21 подключение'],
    [22, '22 подключения'],
  ])('connectionsCount(%i)', (n, text) => expect(connectionsCount(n)).toBe(text));
});

describe('screens and notices', () => {
  it('the connect screen only with no connection and no data', () => {
    expect(startRoute(false, false)).toBe('connect');
    expect(startRoute(true, false)).toBe('home'); // a connection without a token: home asks for it, no second connection
    expect(startRoute(false, true)).toBe('home');
  });

  it('every account turned off: home with a notice, not the connect screen', async () => {
    // Off accounts leave no data (hasData false), but there are connections: home, where the notice leads to «Подключения».
    expect(startRoute(true, false)).toBe('home');
    expect(allAccountsOff([conn(1, { enabledAccounts: 0 }), conn(2, { accounts: 1, enabledAccounts: 0 })])).toBe(true);
    expect(allAccountsOff([conn(1, { enabledAccounts: 0 }), conn(2, { enabledAccounts: 1 })])).toBe(false);
    // Not imported yet: the first import brings its accounts, nothing is off.
    expect(allAccountsOff([conn(1, { enabledAccounts: 0 }), conn(2, { accounts: 0, enabledAccounts: 0 })])).toBe(false);
    expect(allAccountsOff([])).toBe(false);
    api.people = { people: [person(1, 'Я', [conn(1, { enabledAccounts: 0 })])], secureStorage: true };
    const s = useParticipantStore();
    await s.refresh();
    expect(s.accountsOff).toBe(true);
  });

  it('missing tokens: all, some (named), unreadable, or an unfinished import', () => {
    const labelOf = (id: number) => (id === 2 ? 'Вигадана · Monobank' : 'Я · Monobank');
    const missing = [conn(2, { token: token({ present: false, stored: null }) })];
    expect(noTokenText(missing, 1, 'idle', labelOf)).toMatch(/^Нет токена: новые операции не загружаются/);
    expect(noTokenText(missing, 2, 'idle', labelOf)).toBe('Нет токена: Вигадана · Monobank. Их новые операции не загружаются.');
    expect(noTokenText([conn(2, { token: token({ present: false, needsReentry: true }) })], 2, 'idle', labelOf)).toMatch(/Вигадана · Monobank.*заново/);
    expect(noTokenText(missing, 2, 'needs-token', labelOf)).toMatch(/незавершённый импорт/);
  });

  it('after an import: one line per connection that did not import', () => {
    const done = { phase: 'done' as const, windowsTotal: 4, transactions: 9, failed: [{ connectionId: 2, message: 'Monobank не принял токен.' }] };
    expect(failureLines(done, () => 'Вигадана · Monobank')).toEqual(['Вигадана · Monobank: Monobank не принял токен.']);
    expect(failureLines({ phase: 'idle' }, () => 'x')).toEqual([]);
    expect(progressLine({ phase: 'needs-token', connectionIds: [2] }, 0)).toMatch(/«Подключения»/);
  });
});

describe('colours', () => {
  it('who holds each colour among people, except the person being edited; the first free one; the CSS colour', () => {
    const people = [
      { ...person(1, 'Я', [conn(1), conn(2)]), color: 'violet' as const },
      { ...person(2, 'Вигадана', [conn(3)]), color: 'blue' as const },
      { ...person(3, 'Без кольору', []), color: null },
    ];
    expect([...colorHolders(people)]).toEqual([['violet', 'Я'], ['blue', 'Вигадана']]);
    expect([...colorHolders(people, 2)]).toEqual([['violet', 'Я']]);
    expect(firstFreeColor(colorHolders(people))).toBe('orange');
    expect(firstFreeColor(new Map())).toBe('blue');
    expect(colorVar('aqua')).toBe('var(--series-aqua)');
    expect(colorVar(null)).toBe('var(--border-strong)');
  });

  it('the people filter: each person with their colour, the whole family with everyone’s', () => {
    const people = [{ ...person(1, 'Я', []), color: 'violet' as const }, { ...person(2, 'Вигадана', []), color: null }];
    expect(filterOptions(people)).toEqual([
      { label: 'Вся семья', value: FAMILY, colors: ['var(--series-violet)', 'var(--border-strong)'] },
      { label: 'Я', value: 1, colors: ['var(--series-violet)'] },
      { label: 'Вигадана', value: 2, colors: ['var(--border-strong)'] },
    ]);
  });
});
