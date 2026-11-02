// @vitest-environment happy-dom
// The «Categories» section (features/settings/category-kinds, spec desktop-category-kinds): rows with the kind and the
// fixed switch, the changed mark, a change saved and the data refreshed, a failed save rolled back with a message, reset,
// the introduction shown once. Fictional data only; the texts read in Russian (setup-locale).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { CategoryKindQuery, CategoryKindView } from '@contract/api.ts';

const START: CategoryKindView[] = [
  { categoryId: 'groceries', kind: 'essential', fixed: false, changed: false },
  { categoryId: 'clothing', kind: 'essential', fixed: false, changed: true },
  { categoryId: 'rent', kind: 'essential', fixed: true, changed: false },
  { categoryId: 'cash', kind: 'wants', fixed: false, changed: false },
];
let stored: CategoryKindView[] = START;
let failNext = false;
let cash = true;
let failCash = false;
const setCashCounts = vi.fn(async (on: boolean) => {
  if (failCash) throw new Error('refused');
  cash = on;
});
const setCategoryKind = vi.fn(async (q: CategoryKindQuery) => {
  if (failNext) {
    failNext = false;
    throw new Error('refused');
  }
  stored = stored.map((k) => (k.categoryId === q.categoryId ? { ...k, kind: q.kind, fixed: q.fixed, changed: true } : k));
});
const resetCategoryKinds = vi.fn(async () => {
  stored = stored.map((k) => ({ ...k, changed: false }));
});
vi.mock('@/shared/api', () => ({
  balanceApi: {
    getCategoryKinds: async () => stored,
    setCategoryKind: (q: CategoryKindQuery) => setCategoryKind(q),
    resetCategoryKinds: () => resetCategoryKinds(),
    getCashCounts: async () => cash,
    setCashCounts: (on: boolean) => setCashCounts(on),
    getSyncStatus: async () => ({ hasData: true }),
  },
}));

async function mountSection() {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { CategoryKindsFeature } = await import('@/features/settings');
  const w = mount(CategoryKindsFeature, { global: { plugins: [i18n] }, attachTo: document.body });
  await flushPromises();
  return w;
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  stored = START;
  failNext = false;
  cash = true;
  failCash = false;
  setCategoryKind.mockClear();
  setCashCounts.mockClear();
});

describe('categories section', () => {
  it('a row per category with its name, the changed mark only where changed', async () => {
    const w = await mountSection();
    const rows = w.findAll('[data-test="kind-row"]');
    expect(rows.map((r) => r.text())).toEqual([
      expect.stringContaining('Продукты'),
      expect.stringContaining('Одежда'),
      expect.stringContaining('Аренда жилья'),
      expect.stringContaining('Наличные'),
    ]);
    expect(rows.map((r) => r.find('[data-test="kind-changed"]').exists())).toEqual([false, true, false, false]);
    expect(w.find('[data-test="kinds-reset"]').exists()).toBe(true);
    w.unmount();
  });

  it('the fixed switch saves the category with its kind', async () => {
    const w = await mountSection();
    await w.findAll('[data-test="kind-row"]')[0]!.get('input[type="checkbox"]').setValue(true);
    await flushPromises();
    expect(setCategoryKind).toHaveBeenCalledWith({ categoryId: 'groceries', kind: 'essential', fixed: true });
    w.unmount();
  });

  it('a failed save comes back to what is stored and says so', async () => {
    failNext = true;
    const w = await mountSection();
    await w.findAll('[data-test="kind-row"]')[2]!.get('input[type="checkbox"]').setValue(false);
    await flushPromises();
    expect(w.text()).toContain('Не удалось');
    expect((w.findAll('[data-test="kind-row"]')[2]!.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
    w.unmount();
  });

  it('cash withdrawals: the switch on by default, off saves and marks «Cash» as not counted; a failed save comes back', async () => {
    const w = await mountSection();
    const sw = () => w.get<HTMLInputElement>('[data-test="kinds-cash"]');
    expect(sw().element.checked).toBe(true);
    expect(w.find('[data-test="kind-not-counted"]').exists()).toBe(false);
    await sw().setValue(false);
    await flushPromises();
    expect(setCashCounts).toHaveBeenCalledWith(false);
    expect(sw().element.checked).toBe(false);
    expect(w.findAll('[data-test="kind-row"]')[3]!.get('[data-test="kind-not-counted"]').text()).toBe('не учитывается');
    failCash = true;
    await sw().setValue(true);
    await flushPromises();
    expect(sw().element.checked).toBe(false);
    expect(w.find('[data-test="kinds-cash-error"]').text()).toContain('Не удалось');
    w.unmount();
  });

  it('reset to defaults clears the marks and the button goes', async () => {
    const w = await mountSection();
    await w.get('[data-test="kinds-reset"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-test="kind-changed"]').exists()).toBe(false);
    expect(w.find('[data-test="kinds-reset"]').exists()).toBe(false);
    w.unmount();
  });

  it('the introduction shows once; «How it works» brings it back', async () => {
    const w = await mountSection();
    expect(w.find('[data-test="intro-note"]').exists()).toBe(true);
    await w.get('[data-test="intro-close"]').trigger('click');
    w.unmount();
    const again = await mountSection();
    expect(again.find('[data-test="intro-note"]').exists()).toBe(false);
    await again.get('[data-test="intro-show"]').trigger('click');
    expect(again.find('[data-test="intro-note"]').exists()).toBe(true);
    again.unmount();
  });
});
