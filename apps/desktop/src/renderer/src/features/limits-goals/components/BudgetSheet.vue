<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { GoalCurrency, GoalPayload, LimitsOverview } from '@contract/api.ts';
import { RESERVE_AMOUNT_MAX, RESERVE_CURRENCIES } from '@contract/allowance.ts';
import { KIND_CATEGORY_IDS, type KindCategoryId } from '@contract/categories.ts';
import { goalMinor } from '@/entities/goal';
import { currencySymbol, formatMoney, t } from '@/shared/lib';
import { VButton, VInput, VSelect, VSheet, type VSelectOption } from '@/shared/ui';
import type { SheetStart } from '../types.ts';
import { nameOf, pastFlexible, usualTotal } from '../utils.ts';
import PastBars from './PastBars.vue';

// The monthly budget in one sheet: one total for all spending, the user's own fixed costs (a category and the amount
// they type, nothing filled in), whose; beside the form, the live result — the total, each fixed row taken off, the
// flexible part and its average per day, and the past months' flexible spending against it.
const { start, overview, owners, failed = false } = defineProps<{
  start: SheetStart | null;
  overview: LimitsOverview;
  owners: ReadonlyArray<{ id: number; name: string }>;
  failed?: boolean;
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ save: [id: number | null, g: GoalPayload]; delete: [id: number] }>();

const FAMILY = 'family';
const total = ref('');
const currency = ref<GoalCurrency>(980);
const rows = ref<Array<{ categoryId: KindCategoryId; amount: string }>>([]);
const owner = ref<number | string>(FAMILY);
const adding = ref<KindCategoryId | null>(null);
const confirming = ref(false);

watch(
  () => [open.value, start] as const,
  ([isOpen, s]) => {
    if (!isOpen || !s || s.goal.type !== 'budget') return;
    total.value = s.id === null ? '' : String(s.goal.amount / 100);
    currency.value = s.goal.currency;
    rows.value = s.goal.fixed.map((r) => ({ categoryId: r.categoryId, amount: String(r.amount / 100) }));
    owner.value = s.goal.participantId ?? FAMILY;
    confirming.value = false;
  },
  { immediate: true },
);

watch(adding, (id) => {
  if (id === null) return;
  rows.value = [...rows.value, { categoryId: id, amount: '' }];
  adding.value = null;
});

const currencies: VSelectOption[] = RESERVE_CURRENCIES.map((c) => ({ label: currencySymbol(c), value: c }));
const ownerOptions = computed<VSelectOption[]>(() => [...owners.map((p) => ({ label: p.name, value: p.id })), { label: t('limits.owner.family'), value: FAMILY }]);
const free = computed<VSelectOption[]>(() =>
  KIND_CATEGORY_IDS.filter((id) => id !== 'fees' && id !== 'transferFees' && !rows.value.some((r) => r.categoryId === id)).map((id) => ({ label: nameOf(id), value: id })),
);

const totalMinor = computed(() => goalMinor(total.value, RESERVE_AMOUNT_MAX));
const rowMinor = computed(() => rows.value.map((r) => goalMinor(r.amount, RESERVE_AMOUNT_MAX)));
const fixedMinor = computed(() => rowMinor.value.reduce<number>((s, m) => s + (m ?? 0), 0));
const flexibleMinor = computed(() => (totalMinor.value === null ? null : totalMinor.value - fixedMinor.value));
const complete = computed(() => totalMinor.value !== null && rowMinor.value.every((m) => m !== null));
const usual = computed(() => usualTotal(overview, currency.value));
const chips = computed(() => (usual.value ? [usual.value, Math.round(usual.value * 0.9), Math.round(usual.value * 0.8)] : []));
const past = computed(() => pastFlexible(overview, rows.value.map((r) => r.categoryId), currency.value));
const money = (minor: number) => formatMoney(minor, currency.value);
const signed = (minor: number) => `${minor < 0 ? '−' : ''}${money(Math.abs(minor))}`;

function save() {
  if (!complete.value || totalMinor.value === null) return;
  emit('save', start?.id ?? null, {
    type: 'budget',
    currency: currency.value,
    amount: totalMinor.value,
    participantId: typeof owner.value === 'number' ? owner.value : null,
    fixed: rows.value.map((r, i) => ({ categoryId: r.categoryId, amount: rowMinor.value[i]! })),
  });
}
</script>

<template>
  <VSheet v-model:open="open" :title="start?.id ? $t('limits.sheet.editBudget') : $t('limits.sheet.newBudget')" :description="$t('limits.sheet.budgetHint')">
    <form class="flex flex-col gap-5" data-test="budget-sheet" @submit.prevent="save">
      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-bold">1 · {{ $t('limits.sheet.totalTitle') }}</h3>
        <div class="flex flex-wrap items-start gap-2">
          <div class="w-40"><VInput v-model="total" :label="$t('limits.sheet.total')" :show-clear-button="false" data-test="budget-total" /></div>
          <VSelect v-model="currency" :options="currencies" :label="$t('limits.sheet.currency')" class="w-24" />
        </div>
        <div v-if="usual" class="flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
          <span>{{ $t('limits.sheet.usualTotal', { amount: `${usual} ${currencySymbol(currency)}` }) }}</span>
          <button v-for="(c, i) in chips" :key="i" type="button" class="rounded-full border border-border px-2 py-0.5 font-semibold text-foreground-secondary hover:border-primary hover:text-primary" @click="total = String(c)">
            {{ i === 0 ? c : `−${i * 10}% · ${c}` }}
          </button>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-bold">2 · {{ $t('limits.sheet.fixedTitle') }}</h3>
        <p class="text-xs text-foreground-muted">{{ $t('limits.sheet.fixedHint') }}</p>
        <ul class="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
          <li v-if="rows.length === 0" class="px-3 py-2.5 text-sm text-foreground-muted">{{ $t('limits.sheet.fixedNone') }}</li>
          <li v-for="(r, i) in rows" :key="r.categoryId" class="flex items-center gap-2 px-3 py-2" data-test="fixed-input">
            <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ nameOf(r.categoryId) }}</span>
            <div class="w-28"><VInput v-model="r.amount" :placeholder="$t('limits.sheet.amount')" :show-clear-button="false" size="sm" :aria-label="$t('limits.sheet.fixedAmount', { name: nameOf(r.categoryId) })" /></div>
            <span class="text-sm text-foreground-muted">{{ currencySymbol(currency) }}</span>
            <VButton type="button" variant="neutral" size="sm" icon="lucide:x" :aria-label="$t('limits.sheet.remove', { name: nameOf(r.categoryId) })" data-test="fixed-remove" @click="rows.splice(i, 1)" />
          </li>
        </ul>
        <VSelect v-model="adding" :options="free" :placeholder="$t('limits.sheet.addFixed')" :label="$t('limits.sheet.addFixed')" data-test="fixed-add" />
      </section>

      <VSelect v-if="owners.length > 0" v-model="owner" :options="ownerOptions" :label="$t('limits.sheet.owner')" />

      <section class="flex flex-col gap-2 rounded-xl bg-surface-sunken p-3 text-sm tabular-nums" aria-live="polite" data-test="budget-result-live">
        <div class="flex justify-between font-bold"><span>{{ $t('limits.sheet.totalLine') }}</span><span>{{ totalMinor === null ? '—' : money(totalMinor) }}</span></div>
        <div v-for="(r, i) in rows" :key="r.categoryId" class="flex justify-between text-foreground-muted">
          <span>− {{ nameOf(r.categoryId) }}</span><span>{{ rowMinor[i] === null ? $t('limits.sheet.typeAmount') : money(rowMinor[i]!) }}</span>
        </div>
        <div class="flex justify-between border-t border-border pt-2 text-base font-extrabold text-primary" data-test="flexible-live">
          <span>{{ $t('limits.sheet.flexibleLine') }}</span><span>{{ flexibleMinor === null ? '—' : signed(Math.max(0, flexibleMinor)) }}</span>
        </div>
        <div v-if="flexibleMinor !== null && flexibleMinor > 0" class="flex justify-between text-xs text-foreground-muted">
          <span>{{ $t('limits.sheet.perDayAvg') }}</span><span>≈ {{ money(Math.round(flexibleMinor / 30.44)) }}</span>
        </div>
        <p v-if="flexibleMinor !== null && flexibleMinor <= 0" class="text-danger" data-test="takes-all">{{ $t('limits.sheet.takesAll') }}</p>
        <p v-else-if="rows.length === 0" class="text-xs text-warning-foreground">{{ $t('limits.sheet.noFixedWarn') }}</p>
      </section>

      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-bold">{{ $t('limits.sheet.pastTitle') }}</h3>
        <PastBars :months="past" :amount="flexibleMinor !== null && flexibleMinor > 0 ? flexibleMinor : null" :currency />
      </div>

      <p v-if="failed" class="text-sm text-danger" data-test="sheet-failed">{{ $t('limits.sheet.failed') }}</p>
      <div class="flex flex-wrap gap-2">
        <VButton type="submit" variant="primary" :text="$t('limits.sheet.saveBudget')" :disabled="!complete" data-test="budget-save" />
        <VButton type="button" variant="secondary" :text="$t('limits.sheet.cancel')" @click="open = false" />
        <template v-if="start?.id">
          <VButton v-if="!confirming" type="button" variant="negative" :text="$t('limits.sheet.delete')" class="ml-auto" @click="confirming = true" />
          <span v-else class="ml-auto flex items-center gap-2 text-sm">
            {{ $t('limits.sheet.deleteAsk') }}
            <VButton type="button" variant="negative" size="sm" :text="$t('limits.sheet.deleteYes')" data-test="budget-delete" @click="emit('delete', start.id)" />
            <VButton type="button" variant="secondary" size="sm" :text="$t('limits.sheet.cancel')" @click="confirming = false" />
          </span>
        </template>
      </div>
    </form>
  </VSheet>
</template>
