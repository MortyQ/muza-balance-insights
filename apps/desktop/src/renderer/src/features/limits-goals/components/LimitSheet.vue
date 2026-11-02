<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { GoalCurrency, GoalPayload, LimitPeriod, LimitsOverview } from '@contract/api.ts';
import { RESERVE_AMOUNT_MAX, RESERVE_CURRENCIES } from '@contract/allowance.ts';
import { KIND_CATEGORY_IDS, type KindCategoryId } from '@contract/categories.ts';
import { goalMinor } from '@/entities/goal';
import { currencySymbol, t } from '@/shared/lib';
import { VButton, VInput, VSegmentedControl, VSelect, VSheet, type VSelectOption } from '@/shared/ui';
import type { SheetStart } from '../types.ts';
import { nameOf, pastOf, roundUnits } from '../utils.ts';
import PastBars from './PastBars.vue';

// Adds or edits a category limit: what, how much (with the usual month as a suggestion), the period, whose; the past
// whole months against the amount before saving. Deleting asks here, in the sheet.
const { start, overview, owners, failed = false } = defineProps<{
  start: SheetStart | null;
  overview: LimitsOverview;
  owners: ReadonlyArray<{ id: number; name: string }>;
  failed?: boolean;
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ save: [id: number | null, g: GoalPayload]; delete: [id: number] }>();

const FAMILY = 'family';
const category = ref<KindCategoryId>('cafes');
const amount = ref('');
const currency = ref<GoalCurrency>(980);
const period = ref<LimitPeriod>('month');
const owner = ref<number | string>(FAMILY);
const tried = ref(false);
const confirming = ref(false);

watch(
  () => [open.value, start] as const,
  ([isOpen, s]) => {
    if (!isOpen || !s || s.goal.type !== 'limit') return;
    category.value = s.goal.categoryId;
    amount.value = s.id === null ? '' : String(s.goal.amount / 100);
    currency.value = s.goal.currency;
    period.value = s.goal.period;
    owner.value = s.goal.participantId ?? FAMILY;
    tried.value = false;
    confirming.value = false;
  },
  { immediate: true },
);

const categories = computed<VSelectOption[]>(() =>
  // «Cash» only while withdrawals count as spending (a limit already on it stays choosable).
  KIND_CATEGORY_IDS.filter((id) => id !== 'fees' && id !== 'transferFees' && (id !== 'cash' || overview.cashCounts || category.value === 'cash')).map((id) => ({
    label: nameOf(id),
    value: id,
  })),
);
const currencies: VSelectOption[] = RESERVE_CURRENCIES.map((c) => ({ label: currencySymbol(c), value: c }));
const periods = computed(() => (['day', 'week', 'month'] as const).map((p) => ({ value: p, label: t(`limits.period.${p}`) })));
const ownerOptions = computed<VSelectOption[]>(() => [...owners.map((p) => ({ label: p.name, value: p.id })), { label: t('limits.owner.family'), value: FAMILY }]);

const minor = computed(() => goalMinor(amount.value, RESERVE_AMOUNT_MAX));
const past = computed(() => pastOf(overview, category.value, period.value, currency.value));
const suggestion = computed(() => {
  const months = overview.past.byCategory[category.value] ?? [];
  if (months.length < 3) return null;
  const sorted = [...months].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const scale = period.value === 'month' ? 1 : period.value === 'week' ? 7 / 30.44 : 1 / 30.44;
  return roundUnits(median * scale, currency.value, overview.rates);
});
const chips = computed(() => (suggestion.value ? [suggestion.value, Math.round(suggestion.value * 0.9), Math.round(suggestion.value * 0.8)] : []));
const amountError = computed(() => (tried.value && minor.value === null ? t('limits.sheet.amountInvalid') : ''));

function save() {
  tried.value = true;
  if (minor.value === null) return;
  emit('save', start?.id ?? null, {
    type: 'limit',
    categoryId: category.value,
    period: period.value,
    currency: currency.value,
    amount: minor.value,
    participantId: typeof owner.value === 'number' ? owner.value : null,
  });
}
</script>

<template>
  <VSheet v-model:open="open" :title="start?.id ? $t('limits.sheet.editLimit') : $t('limits.sheet.newLimit')" :description="$t('limits.sheet.limitHint')">
    <form class="flex flex-col gap-4" data-test="limit-sheet" @submit.prevent="save">
      <VSelect v-model="category" :options="categories" :label="$t('limits.sheet.what')" />
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-start gap-2">
          <div class="w-40"><VInput v-model="amount" :label="$t('limits.sheet.amount')" :show-clear-button="false" :error="amountError" data-test="limit-amount" /></div>
          <VSelect v-model="currency" :options="currencies" :label="$t('limits.sheet.currency')" class="w-24" />
        </div>
        <div v-if="suggestion" class="flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
          <span>{{ $t('limits.sheet.usual', { amount: `${suggestion} ${currencySymbol(currency)}` }) }}</span>
          <button v-for="(c, i) in chips" :key="i" type="button" class="rounded-full border border-border px-2 py-0.5 font-semibold text-foreground-secondary hover:border-primary hover:text-primary" @click="amount = String(c)">
            {{ i === 0 ? c : `−${i * 10}% · ${c}` }}
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium">{{ $t('limits.sheet.period') }}</span>
        <VSegmentedControl v-model="period" :options="periods" size="sm" />
      </div>
      <VSelect v-if="owners.length > 0" v-model="owner" :options="ownerOptions" :label="$t('limits.sheet.owner')" />
      <PastBars :months="past" :amount="minor" :currency />
      <p class="text-xs text-foreground-muted">{{ $t('limits.sheet.counted') }}</p>
      <p v-if="failed" class="text-sm text-danger" data-test="sheet-failed">{{ $t('limits.sheet.failed') }}</p>
      <div class="flex flex-wrap gap-2">
        <VButton type="submit" variant="primary" :text="$t('limits.sheet.save')" data-test="limit-save" />
        <VButton type="button" variant="secondary" :text="$t('limits.sheet.cancel')" @click="open = false" />
        <template v-if="start?.id">
          <VButton v-if="!confirming" type="button" variant="negative" :text="$t('limits.sheet.delete')" class="ml-auto" @click="confirming = true" />
          <span v-else class="ml-auto flex items-center gap-2 text-sm">
            {{ $t('limits.sheet.deleteAsk') }}
            <VButton type="button" variant="negative" size="sm" :text="$t('limits.sheet.deleteYes')" data-test="limit-delete" @click="emit('delete', start.id)" />
            <VButton type="button" variant="secondary" size="sm" :text="$t('limits.sheet.cancel')" @click="confirming = false" />
          </span>
        </template>
      </div>
    </form>
  </VSheet>
</template>
