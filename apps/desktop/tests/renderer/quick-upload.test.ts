// @vitest-environment happy-dom
// The data screens' statement upload (features/integrations QuickUpload*): the file names its bank, the connection is
// taken, picked or added, then the usual comparison; a file dropped on the window goes the same way. balanceApi is a
// fake; invented data only. Typechecked with the renderer (tsconfig.web.json).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AddConnectionInput,
  AssignStatementResult,
  CompareStatementResult,
  ConnectionView,
  OpenAnyStatementResult,
  PeopleView,
  PersonView,
  StatementTargetInput,
} from '@contract/api.ts';

const conn = (id: number, o: Partial<ConnectionView> = {}): ConnectionView => ({
  id, provider: 'privatbank', method: 'file', bank: 'PrivatBank', accounts: 0, enabledAccounts: 0, coveredFrom: null, coveredTo: null, lastSyncAt: null, token: null, ...o,
});
const person = (id: number, label: string, connections: ConnectionView[]): PersonView => ({ id, label, labelFromBank: false, labelPending: false, color: null, connections });
const OPENED_ANY: OpenAnyStatementResult = { opened: true, statementId: 'st-1', provider: 'privatbank' };
const ASSIGNED: AssignStatementResult = {
  opened: true,
  statementId: 'st-1',
  statements: [{ currencyCode: 980, rows: 3, from: '2026-01-03', to: '2026-01-20', type: null, cardTail: '1111', accounts: [] }],
};

const people = { value: [] as PersonView[] };
const api = vi.hoisted(() => ({
  listPeople: vi.fn(async (): Promise<PeopleView> => ({ people: [], secureStorage: true })),
  getSyncStatus: vi.fn(async () => ({ hasData: true, dataUntil: null, dataFrom: null, lastSyncAt: null })),
  addConnection: vi.fn(async (_input: AddConnectionInput) => ({ added: true as const, connectionId: 9, participantId: 1, stored: null })),
  openAnyStatement: vi.fn(async (): Promise<OpenAnyStatementResult> => ({ opened: false, reason: 'cancelled' })),
  openDroppedStatement: vi.fn(async (_file: File): Promise<OpenAnyStatementResult> => ({ opened: false, reason: 'cancelled' })),
  assignStatement: vi.fn(async (_id: string, _connectionId: number): Promise<AssignStatementResult> => ({ opened: false, reason: 'expired' })),
  compareStatement: vi.fn(async (_id: string, t: Array<StatementTargetInput | null>): Promise<CompareStatementResult> => ({
    ok: true,
    comparisons: t.map(() => ({ match: { kind: 'new' }, rows: 3, matched: 0, amountDiffers: 0, added: 3, missingInFile: 0, gap: null, blocked: null })),
  })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: api }));

const { useQuickUpload } = await import('@/features/integrations/quick-upload/composables/useQuickUpload.ts');
const { connectionsFor } = await import('@/features/integrations/quick-upload/utils.ts');
const { default: QuickUploadFeature } = await import('@/features/integrations/QuickUploadFeature.vue');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  people.value = [];
  api.listPeople.mockImplementation(async () => ({ people: people.value, secureStorage: true }));
  api.openAnyStatement.mockResolvedValue(OPENED_ANY);
  api.assignStatement.mockResolvedValue(ASSIGNED);
  useQuickUpload().close();
});

describe('connectionsFor', () => {
  it("the bank's connections of every person, file and token apart, labelled with the person", () => {
    const list = [
      person(1, 'Вигадана Особа', [conn(1), conn(2, { provider: 'monobank', bank: 'Monobank' })]),
      person(2, 'Інша Особа', [conn(3, { method: 'token' })]),
    ];
    const { files, tokens } = connectionsFor(list, 'privatbank');
    expect(files.map((o) => [o.connection.id, o.label])).toEqual([[1, 'PrivatBank · Вигадана Особа']]);
    expect(tokens.map((o) => o.connection.id)).toEqual([3]);
  });
});

describe('useQuickUpload', () => {
  it('the only file connection of the bank is taken at once', async () => {
    people.value = [person(1, 'Вигадана Особа', [conn(4)])];
    const q = useQuickUpload();
    await q.pick();
    expect(api.assignStatement).toHaveBeenCalledWith('st-1', 4);
    expect(q.state.value).toMatchObject({ step: 'ready', connection: { id: 4 }, opened: ASSIGNED });
  });

  it('several: the user picks; a token one is offered to check against', async () => {
    people.value = [person(1, 'Вигадана Особа', [conn(4), conn(5), conn(6, { method: 'token' })])];
    const q = useQuickUpload();
    await q.pick();
    const s = q.state.value;
    if (s.step !== 'choose') throw new Error(s.step);
    expect(s.files.map((o) => o.connection.id)).toEqual([4, 5]);
    expect(s.tokens.map((o) => o.connection.id)).toEqual([6]);
    expect(api.assignStatement).not.toHaveBeenCalled();
    await q.choose(s.files[1]!);
    expect(api.assignStatement).toHaveBeenCalledWith('st-1', 5);
    expect(q.state.value.step).toBe('ready');
  });

  it('none: a file connection is added for the person, then the file goes to it', async () => {
    people.value = [person(1, 'Вигадана Особа', [])];
    const q = useQuickUpload();
    await q.pick();
    expect(q.state.value.step).toBe('choose');
    api.listPeople.mockImplementation(async () => ({ people: [person(1, 'Вигадана Особа', [conn(9)])], secureStorage: true }));
    await q.addConnection(1);
    expect(api.addConnection).toHaveBeenCalledWith({ participant: { id: 1 }, provider: 'privatbank', method: 'file' });
    expect(api.assignStatement).toHaveBeenCalledWith('st-1', 9);
    expect(q.state.value.step).toBe('ready');
  });

  it('a cancelled dialog shows nothing; a refused file says why; a late file has expired', async () => {
    const q = useQuickUpload();
    api.openAnyStatement.mockResolvedValueOnce({ opened: false, reason: 'cancelled' });
    await q.pick();
    expect(q.state.value).toEqual({ step: 'idle' });
    api.openAnyStatement.mockResolvedValueOnce({ opened: false, reason: 'problem', problem: 'unknown-format', row: null });
    await q.pick();
    expect(q.state.value).toEqual({ step: 'problem', message: 'Файл не похож на выписку этого банка.' });
    people.value = [person(1, 'Вигадана Особа', [conn(4)])];
    api.assignStatement.mockResolvedValueOnce({ opened: false, reason: 'expired' });
    await q.pick();
    expect(q.state.value.step).toBe('problem');
  });

  it('a drop of one file opens it; more than one opens none', async () => {
    const q = useQuickUpload();
    const file = new File(['x'], 'Вигадана.xlsx');
    await q.drop([file]);
    expect(api.openDroppedStatement).toHaveBeenCalledWith(file);
    q.drop([file, file]);
    expect(api.openDroppedStatement).toHaveBeenCalledTimes(1);
    expect(q.state.value).toEqual({ step: 'problem', message: 'Перетащите один файл за раз.' });
  });
});

describe('QuickUploadFeature', () => {
  async function mountIt() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    return mount(QuickUploadFeature, { global: { plugins: [i18n] }, attachTo: document.body });
  }
  const dragEvent = (type: string, files: File[] = []) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(e, 'dataTransfer', { value: { types: ['Files'], files } });
    return e;
  };

  it('a file dragged over the window shows the hint; dropped, it is opened and the hint goes', async () => {
    people.value = [person(1, 'Вигадана Особа', [conn(4)])];
    api.openDroppedStatement.mockResolvedValue(OPENED_ANY);
    const w = await mountIt();
    window.dispatchEvent(dragEvent('dragenter'));
    await flushPromises();
    expect(w.find('[data-test="drop-zone"]').exists()).toBe(true);
    const over = dragEvent('dragover');
    window.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    const file = new File(['x'], 'Вигадана.xlsx');
    window.dispatchEvent(dragEvent('drop', [file]));
    await flushPromises();
    expect(w.find('[data-test="drop-zone"]').exists()).toBe(false);
    expect(api.openDroppedStatement).toHaveBeenCalledWith(file);
    expect(w.find('[data-test="quick-upload"]').text()).toContain('Выписка PrivatBank');
    expect(api.compareStatement).toHaveBeenCalledWith('st-1', [null]);
    w.unmount();
  });

  it('several connections: their buttons; a pick compares the file with it', async () => {
    people.value = [person(1, 'Вигадана Особа', [conn(4), conn(5)])];
    const w = await mountIt();
    await useQuickUpload().pick();
    await flushPromises();
    const buttons = w.findAll('[data-test="quick-upload"] button').filter((b) => b.text().startsWith('PrivatBank'));
    expect(buttons).toHaveLength(2);
    await buttons[1]!.trigger('click');
    await flushPromises();
    expect(api.assignStatement).toHaveBeenCalledWith('st-1', 5);
    w.unmount();
  });
});
