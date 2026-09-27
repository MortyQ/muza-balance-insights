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

const { FAMILY, colorHolders, colorVar, coverageLine, filterOptions, firstFreeColor, tokenBadge, tokenLine, useParticipantStore } = await import('@/entities/participant');
const { startRoute } = await import('@/app/router/startRoute.ts');
const { noTokenText } = await import('@/widgets/home-notices/utils.ts');
const { failureLines, progressLine } = await import('@/features/import-statement/utils.ts');
const { connectionsCount } = await import('@/features/settings/people/utils.ts');
const { participantChoice, removeText } = await import('@/features/integrations/shared/utils.ts');
const { PROVIDER_FORMS } = await import('@/features/integrations/constants.ts');
const { formsOf, isProviderKey } = await import('@/features/integrations/utils.ts');
const { BANKS, MONOBANK, bankOf } = await import('@/entities/bank');
const { ACCESS_NOTE, TOKEN_PLACEHOLDER, TOKEN_STEPS } = await import('@/features/integrations/monobank/constants.ts');

const token = (o: Partial<TokenStatus> = {}): TokenStatus => ({ present: true, stored: 'secure', secureStorage: true, needsReentry: false, ...o });
const conn = (id: number, o: Partial<ConnectionView> = {}): ConnectionView => ({
  id, provider: 'monobank', bank: 'Monobank', color: null, accounts: 2, coveredFrom: null, coveredTo: null, lastSyncAt: null, token: token(), ...o,
});
const person = (id: number, label: string, connections: ConnectionView[]): PersonView => ({ id, label, labelFromBank: false, color: null, connections });

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('participant store', () => {
  it('one person: no switch, always the whole family', async () => {
    api.people = { people: [person(1, 'Я', [conn(1)])], secureStorage: true };
    localStorage.setItem('balance.participant', '1');
    const s = useParticipantStore();
    await s.refresh();
    expect([s.multiple, s.selectedId, s.hasConnections, s.anyToken]).toEqual([false, null, true, true]);
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
    expect(progressLine({ phase: 'needs-token', connectionIds: [2] }, 0)).toMatch(/Люди и подключения/);
  });

  it('who a new connection is for; why a removal did not happen', () => {
    expect(participantChoice(3, 'ignored', true)).toEqual({ id: 3 });
    expect(participantChoice('new', '  Оля ', false)).toEqual({ label: 'Оля' });
    expect(participantChoice('new', '', true)).toEqual({ fromBank: true });
    expect(participantChoice('new', '   ', false)).toBeNull();
    expect(removeText({ removed: false, reason: 'import-running' })).toMatch(/останови импорт/);
    expect(removeText({ removed: false, reason: 'cancelled' })).toBe('');
    expect(removeText({ removed: true })).toBe('');
  });

  it('a bank’s forms by provider; an unknown provider gets the default bank’s', () => {
    expect(isProviderKey('monobank')).toBe(true);
    expect(isProviderKey('privatbank')).toBe(false);
    expect(isProviderKey('toString')).toBe(false);
    expect(formsOf('monobank')).toBe(PROVIDER_FORMS.monobank);
    expect(formsOf('unknown')).toBe(PROVIDER_FORMS.monobank);
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
});

describe('colours', () => {
  it('who holds each colour, except the row being edited; the first free one; the CSS colour', () => {
    const people = [
      { ...person(1, 'Я', [conn(1, { color: 'blue' }), conn(2, { color: null })]), color: 'violet' as const },
      { ...person(2, 'Вигадана', [conn(3, { color: 'orange' })]), color: 'blue' as const },
    ];
    expect([...colorHolders(people, 'people')]).toEqual([['violet', 'Я'], ['blue', 'Вигадана']]);
    expect([...colorHolders(people, 'people', 2)]).toEqual([['violet', 'Я']]);
    expect([...colorHolders(people, 'connections', 3)]).toEqual([['blue', 'Я · Monobank']]);
    expect(firstFreeColor(colorHolders(people, 'connections'))).toBe('aqua');
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

  it('a new person carries the chosen colour; an existing one does not', () => {
    expect(participantChoice('new', 'Вигадана', false, 'green')).toEqual({ label: 'Вигадана', color: 'green' });
    expect(participantChoice('new', '', true, 'green')).toEqual({ fromBank: true, color: 'green' });
    expect(participantChoice('new', 'Вигадана', false, null)).toEqual({ label: 'Вигадана' });
    expect(participantChoice(4, '', false, 'green')).toEqual({ id: 4 });
  });
});
