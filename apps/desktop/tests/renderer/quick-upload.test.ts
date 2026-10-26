// @vitest-environment happy-dom
// The upload sheet (features/integrations QuickUpload*): main opens several files and matches each account to the
// connection that has it; the sheet asks whose an unmatched account is, and one «Import» writes the ready files. Files
// dropped on the window go the same way. balanceApi is a fake; invented data only. Typechecked with the renderer
// (tsconfig.web.json).
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommitUploadResult, OpenUploadResult, PeopleView, PersonView, UploadAccountView, UploadChoices, UploadFileView } from '@contract/api.ts';

const person = (id: number, label: string): PersonView => ({ id, label, labelFromBank: false, labelPending: false, color: null, connections: [] });
const account = (o: Partial<UploadAccountView> = {}): UploadAccountView => ({
  currencyCode: 980, rows: 3, from: '2026-01-03', to: '2026-01-20', type: null, cardTail: '1111', match: null, added: 3, matched: 0, blocked: null, ...o,
});
const KNOWN = account({ cardTail: '2222', match: { connectionId: 4, participantId: 1, method: 'file' }, added: 1, matched: 2 });
const FILES: UploadFileView[] = [
  { ok: true, provider: 'privatbank', accounts: [KNOWN, account()] },
  { ok: false, problem: 'unknown-format', row: null },
];

const people = { value: [] as PersonView[] };
const api = vi.hoisted(() => ({
  listPeople: vi.fn(async (): Promise<PeopleView> => ({ people: [], secureStorage: true })),
  getSyncStatus: vi.fn(async () => ({ hasData: true, dataUntil: null, dataFrom: null, lastSyncAt: null })),
  openUpload: vi.fn(async (_connectionId?: number): Promise<OpenUploadResult> => ({ opened: false, reason: 'cancelled' })),
  openDroppedUpload: vi.fn(async (_files: File[]): Promise<OpenUploadResult> => ({ opened: false, reason: 'cancelled' })),
  commitUpload: vi.fn(async (_id: string, c: UploadChoices): Promise<CommitUploadResult> => (structuredClone(c), { written: true, added: 4, files: [{ written: true, added: 4 }, { written: false, reason: 'unread' }] })),
}));
vi.mock('@/shared/api', () => ({ balanceApi: api }));

const { useQuickUpload } = await import('@/features/integrations/quick-upload/composables/useQuickUpload.ts');
const { summary, initialChoices } = await import('@/features/integrations/quick-upload/utils.ts');
const { default: QuickUploadFeature } = await import('@/features/integrations/QuickUploadFeature.vue');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  people.value = [person(1, 'Вигадана Особа'), person(2, 'Інша Особа')];
  api.listPeople.mockImplementation(async () => ({ people: people.value, secureStorage: true }));
  api.openUpload.mockResolvedValue({ opened: true, uploadId: 'up-1', files: FILES });
  useQuickUpload().close();
});

describe('the sheet helpers', () => {
  it('an account no connection has waits for a person (the only one is taken); a file is ready when all its accounts have one', () => {
    expect(initialChoices(FILES, null)).toEqual([[null, null], []]);
    expect(initialChoices(FILES, 7)).toEqual([[null, 7], []]);
    expect(summary(FILES, [[null, null], []])).toEqual({ ready: 0, waiting: 1, added: 0 });
    expect(summary(FILES, [[null, 2], []])).toEqual({ ready: 2, waiting: 0, added: 4 });
    const token: UploadFileView[] = [{ ok: true, provider: 'monobank', accounts: [account({ match: { connectionId: 1, participantId: 1, method: 'token' }, blocked: 'token' })] }];
    expect(summary(token, [[null]])).toEqual({ ready: 0, waiting: 0, added: 0 });
  });
});

describe('useQuickUpload', () => {
  it('opens, takes a person, imports; the choices go to main per file and per account', async () => {
    const u = useQuickUpload();
    await u.pick();
    expect(u.state.value).toMatchObject({ step: 'review', uploadId: 'up-1', choices: [[null, null], []] });
    u.choose(0, 1, 2);
    await u.commit();
    expect(api.commitUpload).toHaveBeenCalledWith('up-1', [[null, 2], []]);
    expect(u.state.value).toEqual({ step: 'done', request: {}, message: 'Добавлено операций: 4.' });
  });

  it('bound to a connection: main gets its id; too many files and an expired upload say why; a cancelled dialog shows nothing', async () => {
    const u = useQuickUpload();
    await u.pick({ connectionId: 4, provider: 'privatbank', from: '2026-09-22' });
    expect(api.openUpload).toHaveBeenCalledWith(4);
    api.openUpload.mockResolvedValueOnce({ opened: false, reason: 'too-many' });
    await u.pick();
    expect(u.state.value).toMatchObject({ step: 'problem', message: 'За раз — не больше 12 файлов.' });
    api.openUpload.mockResolvedValueOnce({ opened: false, reason: 'cancelled' });
    await u.pick();
    expect(u.state.value).toEqual({ step: 'idle' });

    await u.pick();
    api.commitUpload.mockResolvedValueOnce({ written: false, reason: 'import-running' });
    await u.commit();
    expect(u.state.value).toMatchObject({ step: 'review', busy: false, error: 'Сначала дождись конца импорта.' });
    api.commitUpload.mockResolvedValueOnce({ written: false, reason: 'expired' });
    await u.commit();
    expect(u.state.value).toMatchObject({ step: 'problem' });
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
  const sheet = () => document.body.querySelector('[data-test="quick-upload"]');

  it('files dragged over the window show the hint; dropped, all of them are opened in the sheet', async () => {
    api.openDroppedUpload.mockResolvedValue({ opened: true, uploadId: 'up-1', files: FILES });
    const w = await mountIt();
    window.dispatchEvent(dragEvent('dragenter'));
    await flushPromises();
    expect(w.find('[data-test="drop-zone"]').exists()).toBe(true);
    const over = dragEvent('dragover');
    window.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    const files = [new File(['x'], 'Вигадана-1.xlsx'), new File(['y'], 'Вигадана-2.csv')];
    window.dispatchEvent(dragEvent('drop', files));
    await flushPromises();
    expect(w.find('[data-test="drop-zone"]').exists()).toBe(false);
    expect(api.openDroppedUpload).toHaveBeenCalledWith(files);
    expect(sheet()?.querySelectorAll('[data-test="upload-card"]')).toHaveLength(2);
    expect(sheet()?.querySelectorAll('[data-test="upload-unknown"]')).toHaveLength(1);
    w.unmount();
  });

  it('a known card shows its person; a new one asks whose; «Import» waits until it has one', async () => {
    const w = await mountIt();
    await useQuickUpload().pick();
    await flushPromises();
    const cards = sheet()!.querySelectorAll('[data-test="upload-card"]');
    expect(cards[0]!.querySelector('[data-test="upload-owner"]')?.textContent).toBe('Вигадана Особа');
    expect(cards[0]!.textContent).toContain('•• 2222');
    expect(cards[1]!.textContent).toContain('Чей счёт?');
    expect(document.body.querySelector('[data-test="upload-summary"]')?.textContent).toContain('ждут выбора человека: 1');
    expect(document.body.querySelector<HTMLButtonElement>('[data-test="upload-import"]')?.disabled).toBe(true);

    useQuickUpload().choose(0, 1, 2);
    await flushPromises();
    const button = document.body.querySelector<HTMLButtonElement>('[data-test="upload-import"]')!;
    expect(button.disabled).toBe(false);
    button.click();
    await flushPromises();
    expect(api.commitUpload).toHaveBeenCalledWith('up-1', [[null, 2], []]);
    expect(sheet()?.textContent).toContain('Добавлено операций: 4.');
    w.unmount();
  });

  it('bound to a connection: the sheet says from which date and where to download the statement', async () => {
    const w = await mountIt();
    await useQuickUpload().pick({ connectionId: 4, provider: 'privatbank', from: '2026-09-22' });
    await flushPromises();
    const text = document.body.querySelector('[role="dialog"]')?.textContent ?? '';
    expect(text).toContain('Загрузите выписку с 22.09.');
    expect(text).toContain('Приват24');
    w.unmount();
  });
});
