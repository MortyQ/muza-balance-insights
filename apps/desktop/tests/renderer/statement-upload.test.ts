// @vitest-environment happy-dom
// Statement files on the screen: connecting a bank by file, «Upload statement» and «Check against a statement» in a
// connection row — the texts, the steps, what is sent to main. balanceApi is a fake; invented data only.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import type {
  AddConnectionInput,
  CommitStatementResult,
  CompareStatementResult,
  ConnectionView,
  ConnectionAccountView,
  OpenStatementResult,
  OpenedStatementView,
  StatementComparisonView,
  StatementTargetInput,
} from '@contract/api.ts';

const comparison = (o: Partial<StatementComparisonView> = {}): StatementComparisonView => ({
  match: { kind: 'new' }, rows: 5, matched: 0, amountDiffers: 0, added: 5, missingInFile: 0, gap: null, blocked: null, ...o,
});
const account = (s: Partial<OpenedStatementView> = {}): OpenedStatementView => ({
  currencyCode: 980, rows: 5, from: '2026-10-03', to: '2026-10-07', type: null, cardTail: null, accounts: [], ...s,
});
const card = (id: string, o: Partial<ConnectionAccountView> = {}): ConnectionAccountView => ({
  id, kind: 'card', type: 'black', currencyCode: 980, maskedPanTail: '0000', jarTitle: null, enabled: true, auto: true, ...o,
});
const OPENED: OpenStatementResult = { opened: true, statementId: 'st-1', statements: [account()] };

const api = vi.hoisted(() => ({
  listPeople: vi.fn(async () => ({ people: [], secureStorage: true })),
  getSyncStatus: vi.fn(async () => ({ hasData: true, dataUntil: null, dataFrom: null, lastSyncAt: null })),
  addConnection: vi.fn(async (_input: AddConnectionInput) => ({ added: true as const, connectionId: 7, participantId: 1, stored: null })),
  openStatement: vi.fn(async (_id: number): Promise<OpenStatementResult> => ({ opened: false, reason: 'cancelled' })),
  compareStatement: vi.fn(async (_id: string, t: Array<StatementTargetInput | null>): Promise<CompareStatementResult> => ({ ok: true, comparisons: t.map(() => comparison()) })),
  commitStatement: vi.fn(async (_id: string, _t: StatementTargetInput[]): Promise<CommitStatementResult> => ({ written: true, added: 5 })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: api }));

const { canWrite, comparisonLines, commitText, defaultTarget, initialTargets, newCardType, openProblemText, statementLabel, summaryText } = await import(
  '@/features/integrations/statement-file/utils.ts'
);
const { useStatementUpload } = await import('@/features/integrations/statement-file/composables/useStatementUpload.ts');
const { PROBLEM_TEXT } = await import('@/features/integrations/statement-file/constants.ts');
const { CARD_TYPE_NAMES, FILE_STEPS } = await import('@/features/integrations/monobank/constants.ts');
const { PROVIDER_FORMS } = await import('@/features/integrations/constants.ts');

const conn = (method: 'token' | 'file', o: Partial<ConnectionView> = {}): ConnectionView => ({
  id: 7, provider: 'monobank', method, bank: 'Monobank', accounts: 0, enabledAccounts: 0, coveredFrom: null, coveredTo: null, lastSyncAt: null,
  token: method === 'token' ? { present: true, stored: 'secure', secureStorage: true, needsReentry: false } : null, ...o,
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('texts', () => {
  it('every problem code has its text; a bad row names its line; a cancelled dialog says nothing', () => {
    expect(Object.keys(PROBLEM_TEXT).sort()).toEqual([
      'ambiguous', 'bad-row', 'empty', 'encrypted', 'language', 'no-format', 'other-bank', 'over-limits', 'timeout', 'too-large', 'unknown-format', 'unreadable', 'unsupported-kind',
    ]);
    for (const problem of Object.keys(PROBLEM_TEXT) as Array<keyof typeof PROBLEM_TEXT>) {
      expect(openProblemText({ opened: false, reason: 'problem', problem, row: 1 })).not.toBe('');
    }
    // The wording names no file format: any bank's file goes through it.
    expect(openProblemText({ opened: false, reason: 'problem', problem: 'unknown-format', row: null })).toBe('Файл не похож на выписку этого банка.');
    expect(openProblemText({ opened: false, reason: 'problem', problem: 'encrypted', row: null })).toMatch(/паролем/);
    expect(openProblemText({ opened: false, reason: 'problem', problem: 'bad-row', row: 3 })).toBe('Строка 3 файла не читается.');
    expect(openProblemText({ opened: false, reason: 'problem', problem: 'language', row: null })).toMatch(/на украинском/);
    expect(openProblemText({ opened: false, reason: 'cancelled' })).toBe('');
    expect(openProblemText(OPENED)).toBe('');
  });

  it('the summary and the comparison: counts, what differs, what blocks, nothing new', () => {
    expect(summaryText({ rows: 5, from: '2026-10-03', to: '2026-10-07' })).toBe('Операций в файле: 5 · 03.10.2026 – 07.10.2026');
    expect(comparisonLines(comparison())).toEqual(['Уже есть: 0 · Новых: 5']);
    expect(comparisonLines(comparison({ matched: 3, amountDiffers: 1, missingInFile: 2, added: 1, blocked: 'token' }))).toEqual([
      'Уже есть: 3 · Новых: 1',
      'Та же секунда, другая сумма: 1',
      'Есть здесь, но нет в файле: 2',
      'Это подключение по токену: выписку можно только сверить, записать её сюда нельзя.',
    ]);
    expect(comparisonLines(comparison({ blocked: 'gap', gap: { from: '2026-10-07', to: '2026-11-02' } })).at(-1)).toBe(
      'С 07.10.2026 по 02.11.2026 нет данных: сначала загрузи выписку за эти дни.',
    );
    expect(comparisonLines(comparison({ matched: 5, added: 0 })).at(-1)).toBe('Новых операций нет.');
  });

  it('after «Add»', () => {
    expect(commitText({ written: true, added: 4 })).toBe('Добавлено операций: 4.');
    expect(commitText({ written: false, reason: 'expired' })).toBe('Выбери файл ещё раз.');
    expect(commitText({ written: false, reason: 'import-running' })).toBe('Сначала дождись конца импорта.');
  });

  it('the account offered first: the only card, else a new card for a file connection, else the first card', () => {
    expect(defaultTarget([{ id: 'a' }], true)).toBe('a');
    expect(defaultTarget([{ id: 'a' }, { id: 'b' }], true)).toBe('new');
    expect(defaultTarget([], true)).toBe('new');
    expect(defaultTarget([{ id: 'a' }, { id: 'b' }], false)).toBe('a');
  });

  it('the targets offered first: what the file matched, else the default among the cards still free; one card goes to one account', () => {
    const file = { opened: true as const, statementId: 'st-1', statements: [account({ accounts: [card('a')] }), account({ accounts: [card('a')] }), account({ accounts: [card('a'), card('b')] })] };
    const matched = [comparison(), comparison({ match: { kind: 'account', accountId: 'a' } }), comparison()];
    expect(initialTargets(file, matched, true)).toEqual(['new', 'a', 'b']);
    expect(initialTargets(file, [comparison(), comparison(), comparison()], true)).toEqual(['a', 'new', 'b']);
  });

  it('an account of the file on the screen: the known card type, the currency, the last digits; an unknown type is not shown', () => {
    expect(statementLabel(account({ type: 'white', currencyCode: 840, cardTail: '1111' }), CARD_TYPE_NAMES)).toBe('Белая карта · USD · •• 1111');
    expect(statementLabel(account({ type: 'Картка Вигадана' }), CARD_TYPE_NAMES)).toBe('Карта · UAH');
    expect(newCardType(account({ type: 'white' }), CARD_TYPE_NAMES)).toBe('white');
    expect(newCardType(account({ type: 'Картка Вигадана' }), CARD_TYPE_NAMES)).toBe('black');
  });

  it('the file is written only whole: one blocked account blocks it, nothing new adds nothing', () => {
    expect(canWrite([comparison(), comparison({ added: 0 })])).toBe(true);
    expect(canWrite([comparison(), comparison({ blocked: 'gap' })])).toBe(false);
    expect(canWrite([comparison({ added: 0 }), comparison({ added: 0 })])).toBe(false);
  });

  it('Monobank has its file steps and a type for a new card', () => {
    expect(PROVIDER_FORMS.monobank.fileSteps).toBe(FILE_STEPS);
    expect(Object.keys(CARD_TYPE_NAMES)).toContain('black');
  });
});

describe('useStatementUpload', () => {
  it('a file connection: open, compare with a new black card, add; then people and the data status reload', async () => {
    api.openStatement.mockResolvedValueOnce(OPENED);
    const u = useStatementUpload(conn('file'), CARD_TYPE_NAMES);
    await u.open();
    await flushPromises();
    // The file picks first; it matched nothing and the connection has no card: a new one, compared once.
    expect(api.compareStatement.mock.calls).toEqual([['st-1', [null]]]);
    expect(u.targets.value).toEqual(['new']);
    expect(u.canAdd.value).toBe(true);

    u.newTypes.value[0] = 'white';
    await flushPromises();
    expect(api.compareStatement).toHaveBeenLastCalledWith('st-1', [{ kind: 'new', type: 'white' }]);

    await u.add();
    expect(api.commitStatement).toHaveBeenCalledWith('st-1', [{ kind: 'new', type: 'white' }]);
    expect(u.state.value).toEqual({ step: 'done', message: 'Добавлено операций: 5.' });
    expect(api.listPeople).toHaveBeenCalled();
    expect(api.getSyncStatus).toHaveBeenCalled();
  });

  it('a token connection: its card is compared, nothing can be added', async () => {
    api.openStatement.mockResolvedValueOnce({ ...OPENED, statements: [account({ accounts: [card('api-black')] })] });
    api.compareStatement.mockResolvedValueOnce({ ok: true, comparisons: [comparison({ blocked: 'token' })] });
    api.compareStatement.mockResolvedValueOnce({ ok: true, comparisons: [comparison({ match: { kind: 'account', accountId: 'api-black' }, matched: 5, added: 0, blocked: 'token' })] });
    const u = useStatementUpload(conn('token', { accounts: 1 }), CARD_TYPE_NAMES);
    await u.open();
    await flushPromises();
    // The file matched no card, so its card is offered and compared again.
    expect(api.compareStatement).toHaveBeenLastCalledWith('st-1', [{ kind: 'account', accountId: 'api-black' }]);
    expect(api.compareStatement).toHaveBeenCalledTimes(2);
    expect(u.canAdd.value).toBe(false);
    await u.add();
    expect(api.commitStatement).not.toHaveBeenCalled();
  });

  it('two accounts: each its own target and comparison; one «Add» writes both; a blocked one blocks it', async () => {
    api.openStatement.mockResolvedValueOnce({ ...OPENED, statements: [account(), account({ currencyCode: 840, type: 'white', cardTail: '1111', accounts: [card('usd', { currencyCode: 840 })] })] });
    api.compareStatement.mockResolvedValueOnce({ ok: true, comparisons: [comparison(), comparison({ match: { kind: 'account', accountId: 'usd' }, added: 2 })] });
    const u = useStatementUpload(conn('file'), CARD_TYPE_NAMES);
    await u.open();
    await flushPromises();
    expect(u.targets.value).toEqual(['new', 'usd']);
    expect(u.newTypes.value).toEqual(['black', 'white']);
    expect(api.compareStatement).toHaveBeenCalledTimes(1);
    expect(u.canAdd.value).toBe(true);

    api.compareStatement.mockResolvedValueOnce({ ok: true, comparisons: [comparison(), comparison({ blocked: 'gap', gap: { from: '2026-09-01', to: '2026-10-02' } })] });
    u.targets.value[1] = 'new';
    await flushPromises();
    expect(api.compareStatement).toHaveBeenLastCalledWith('st-1', [{ kind: 'new', type: 'black' }, { kind: 'new', type: 'white' }]);
    expect(u.canAdd.value).toBe(false);
    await u.add();
    expect(api.commitStatement).not.toHaveBeenCalled();

    u.targets.value[1] = 'usd';
    await flushPromises();
    await u.add();
    expect(api.commitStatement).toHaveBeenCalledWith('st-1', [{ kind: 'new', type: 'black' }, { kind: 'account', accountId: 'usd' }]);
  });

  it('a cancelled dialog goes back to the start; a refused file shows why', async () => {
    const u = useStatementUpload(conn('file'), CARD_TYPE_NAMES);
    await u.open();
    expect(u.state.value).toEqual({ step: 'idle' });
    api.openStatement.mockResolvedValueOnce({ opened: false, reason: 'problem', problem: 'too-large', row: null });
    await u.open();
    expect(u.state.value).toEqual({ step: 'problem', message: 'Файл слишком большой: больше 10 МБ.' });
    expect(api.compareStatement).not.toHaveBeenCalled();
  });

  it('an expired statement asks for the file again', async () => {
    api.openStatement.mockResolvedValueOnce(OPENED);
    api.compareStatement.mockResolvedValueOnce({ ok: false, reason: 'expired' });
    const u = useStatementUpload(conn('file'), CARD_TYPE_NAMES);
    await u.open();
    await flushPromises();
    expect(u.state.value).toEqual({ step: 'problem', message: 'Выбери файл ещё раз.' });
  });
});

describe('on the screen', () => {
  async function mountIt(component: Component, props: Record<string, unknown>) {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    return mount(component, { props, global: { plugins: [i18n] }, attachTo: document.body });
  }

  it('«Upload statement»: the steps, the file, «Add» after the comparison; a token connection gets no «Add»', async () => {
    const { default: StatementUploadFeature } = await import('@/features/integrations/statement-file/StatementUploadFeature.vue');
    api.openStatement.mockResolvedValue(OPENED);
    const w = await mountIt(StatementUploadFeature, { connection: conn('file'), cardTypes: CARD_TYPE_NAMES, steps: FILE_STEPS });
    expect(w.text()).toContain('В приложении Monobank сформируй выписку карты в формате CSV на украинском языке.');
    await w.find('button').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Операций в файле: 5 · 03.10.2026 – 07.10.2026');
    expect(w.text()).toContain('Уже есть: 0 · Новых: 5');
    const add = w.findAll('button').find((b) => b.text() === 'Добавить');
    expect(add?.attributes('disabled')).toBeUndefined();
    w.unmount();

    api.openStatement.mockResolvedValueOnce({ ...OPENED, statements: [account(), account({ currencyCode: 840, type: 'white', cardTail: '1111', rows: 2 })] });
    const two = await mountIt(StatementUploadFeature, { connection: conn('file'), cardTypes: CARD_TYPE_NAMES, steps: FILE_STEPS });
    await two.find('button').trigger('click');
    await flushPromises();
    expect(two.findAll('section')).toHaveLength(2);
    expect(two.text()).toContain('Белая карта · USD · •• 1111');
    expect(two.findAll('button').filter((b) => b.text() === 'Добавить')).toHaveLength(1);
    two.unmount();

    const t = await mountIt(StatementUploadFeature, { connection: conn('token', { accounts: 1 }), cardTypes: CARD_TYPE_NAMES, steps: FILE_STEPS });
    await t.find('button').trigger('click');
    await flushPromises();
    expect(t.findAll('button').some((b) => b.text() === 'Добавить')).toBe(false);
    t.unmount();
  });

  it('the add form: Monobank offers both ways; «Statement file» adds a connection without a token', async () => {
    const { default: AddConnectionFeature } = await import('@/features/integrations/AddConnectionFeature.vue');
    const w = await mountIt(AddConnectionFeature, { provider: 'monobank', defaultLabel: 'Я' });
    await flushPromises();
    expect(w.text()).toContain('Как подключить');
    expect(w.text()).toContain('Приложение само загружает новые операции по токену.');
    const fileOption = w.findAll('button').find((b) => b.text() === 'Файл выписки');
    await fileOption?.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Без токена: ты загружаешь выписку файлом');
    expect(w.find('input[type="password"]').exists()).toBe(false);
    expect(w.text()).not.toContain('Взять имя из банка');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(api.addConnection).toHaveBeenCalledWith({ participant: { label: 'Я', color: expect.any(String) }, provider: 'monobank', method: 'file' });
    expect(w.emitted('added')).toHaveLength(1);
    w.unmount();
  });
});
