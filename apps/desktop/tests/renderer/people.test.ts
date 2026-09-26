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

const { FAMILY, coverageLine, tokenLine, useParticipantStore } = await import('@/entities/participant');
const { startRoute } = await import('@/app/router/startRoute.ts');
const { noTokenText } = await import('@/widgets/home-notices/utils.ts');
const { failureLines, progressLine } = await import('@/features/import-statement/utils.ts');
const { participantChoice, removeText } = await import('@/features/people/utils.ts');

const token = (o: Partial<TokenStatus> = {}): TokenStatus => ({ present: true, stored: 'secure', secureStorage: true, needsReentry: false, ...o });
const conn = (id: number, o: Partial<ConnectionView> = {}): ConnectionView => ({
  id, provider: 'monobank', bank: 'Monobank', accounts: 2, coveredFrom: null, coveredTo: null, lastSyncAt: null, token: token(), ...o,
});
const person = (id: number, label: string, connections: ConnectionView[]): PersonView => ({ id, label, labelFromBank: false, connections });

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
});
