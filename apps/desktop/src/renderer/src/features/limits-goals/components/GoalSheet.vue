<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { GoalPayload, LimitsOverview } from '@contract/api.ts';
import { RESERVE_AMOUNT_MAX, RESERVE_NAME_MAX } from '@contract/allowance.ts';
import { type AppCurrency, isAppCurrency } from '@contract/currencies.ts';
import { accountName } from '@/entities/bank';
import { goalMinor } from '@/entities/goal';
import { currencyOptions, useCurrencyDisplayStore } from '@/entities/currency-display';
import { formatMoney, t } from '@/shared/lib';
import { VButton, VCheckbox, VDatepicker, VInput, VSegmentedControl, VSelect, VSheet, type VSelectOption } from '@/shared/ui';
import type { SheetStart } from '../types.ts';

// Adds or edits a savings goal: a name, the target, an optional date, whose, and where its progress comes from — one
// jar (its target in the bank is offered) or the owner's cards and jars.
const { start, overview, owners, failed = false } = defineProps<{
  start: SheetStart | null;
  overview: LimitsOverview;
  owners: ReadonlyArray<{ id: number; name: string }>;
  failed?: boolean;
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ save: [id: number | null, g: GoalPayload]; delete: [id: number] }>();

const FAMILY = 'family';
const name = ref('');
const amount = ref('');
const currency = ref<AppCurrency>(980);
const source = ref<'jar' | 'own'>('jar');
const jar = ref<string | null>(null);
const noDate = ref(true);
const until = ref<string | null>(null);
const owner = ref<number | string>(FAMILY);
const tried = ref(false);
const confirming = ref(false);

// A jar with its own target in the bank offers it, when nothing is typed yet (set before the start's watcher, so a
// new goal that starts on a jar gets it too).
watch(jar, (id) => {
  const j = overview.jars.find((x) => x.id === id);
  if (!j || j.goal === null || amount.value !== '') return;
  if (isAppCurrency(j.currency)) {
    currency.value = j.currency;
    amount.value = String(Math.round(j.goal / 100));
  }
});

watch(
  () => [open.value, start] as const,
  ([isOpen, s]) => {
    if (!isOpen || !s || s.goal.type !== 'saving') return;
    name.value = s.goal.name;
    amount.value = s.id === null ? '' : String(s.goal.amount / 100);
    currency.value = s.goal.currency;
    source.value = overview.jars.length === 0 ? 'own' : s.goal.source;
    jar.value = s.goal.accountId;
    noDate.value = s.goal.until === null;
    until.value = s.goal.until;
    owner.value = s.goal.participantId ?? FAMILY;
    tried.value = false;
    confirming.value = false;
  },
  { immediate: true },
);

const currencyStore = useCurrencyDisplayStore();
const currencies = computed(() => currencyOptions(currencyStore.rates ?? null, currency.value));
const sources = computed(() => [
  { value: 'jar' as const, label: t('limits.goals.sourceJar'), disabled: overview.jars.length === 0 },
  { value: 'own' as const, label: t('limits.goals.sourceOwn') },
]);
const jarOptions = computed<VSelectOption[]>(() =>
  overview.jars.map((j) => ({ value: j.id, label: j.goal === null ? accountName(j.name) : `${accountName(j.name)} · ${t('limits.goals.jarTarget', { amount: formatMoney(j.goal, j.currency) })}` })),
);
const ownerOptions = computed<VSelectOption[]>(() => [...owners.map((p) => ({ label: p.name, value: p.id })), { label: t('limits.owner.family'), value: FAMILY }]);

const minor = computed(() => goalMinor(amount.value, RESERVE_AMOUNT_MAX));
const nameOk = computed(() => {
  const n = [...name.value.trim()].length;
  return n >= 1 && n <= RESERVE_NAME_MAX;
});
const errors = computed(() => ({
  name: tried.value && !nameOk.value ? t('limits.goals.nameInvalid', { max: RESERVE_NAME_MAX }) : '',
  amount: tried.value && minor.value === null ? t('limits.sheet.amountInvalid') : '',
  jar: tried.value && source.value === 'jar' && jar.value === null ? t('limits.goals.jarMissing') : '',
  date: tried.value && !noDate.value && until.value === null ? t('limits.goals.dateMissing') : '',
}));

function save() {
  tried.value = true;
  if (!nameOk.value || minor.value === null || (source.value === 'jar' && jar.value === null) || (!noDate.value && until.value === null)) return;
  emit('save', start?.id ?? null, {
    type: 'saving',
    name: name.value.trim(),
    currency: currency.value,
    amount: minor.value,
    participantId: typeof owner.value === 'number' ? owner.value : null,
    until: noDate.value ? null : until.value,
    source: source.value,
    accountId: source.value === 'jar' ? jar.value : null,
  });
}
</script>

<template>
  <VSheet v-model:open="open" :title="start?.id ? $t('limits.goals.edit') : $t('limits.goals.new')" :description="$t('limits.goals.hint')">
    <form class="flex flex-col gap-4" data-test="goal-sheet" @submit.prevent="save">
      <VInput v-model="name" :label="$t('limits.goals.name')" :placeholder="$t('limits.goals.namePlaceholder')" :show-clear-button="false" :error="errors.name" data-test="goal-name" />
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium">{{ $t('limits.goals.source') }}</span>
        <VSegmentedControl v-model="source" :options="sources" size="sm" />
      </div>
      <VSelect v-if="source === 'jar'" v-model="jar" :options="jarOptions" :label="$t('limits.goals.jar')" :placeholder="$t('limits.goals.jarPick')" />
      <p v-if="errors.jar" class="text-xs text-danger">{{ errors.jar }}</p>
      <p v-if="source === 'own'" class="text-xs text-foreground-muted">{{ $t('limits.goals.ownHint') }}</p>
      <div class="flex flex-wrap items-start gap-2">
        <div class="w-40"><VInput v-model="amount" :label="$t('limits.goals.target')" :show-clear-button="false" :error="errors.amount" data-test="goal-amount" /></div>
        <VSelect v-model="currency" :options="currencies" :label="$t('limits.sheet.currency')" class="w-24" />
      </div>
      <div class="flex flex-col gap-2">
        <VCheckbox v-model="noDate" :label="$t('limits.goals.noDate')" />
        <VDatepicker v-if="!noDate" v-model="until" :label="$t('limits.goals.until')" :min="overview.today" class="w-56" />
        <p v-if="errors.date" class="text-xs text-danger">{{ errors.date }}</p>
      </div>
      <VSelect v-if="owners.length > 0" v-model="owner" :options="ownerOptions" :label="$t('limits.sheet.owner')" />
      <p v-if="failed" class="text-sm text-danger" data-test="sheet-failed">{{ $t('limits.sheet.failed') }}</p>
      <div class="flex flex-wrap gap-2">
        <VButton type="submit" variant="primary" :text="$t('limits.sheet.save')" data-test="goal-save" />
        <VButton type="button" variant="secondary" :text="$t('limits.sheet.cancel')" @click="open = false" />
        <template v-if="start?.id">
          <VButton v-if="!confirming" type="button" variant="negative" :text="$t('limits.sheet.delete')" class="ml-auto" @click="confirming = true" />
          <span v-else class="ml-auto flex items-center gap-2 text-sm">
            {{ $t('limits.sheet.deleteAsk') }}
            <VButton type="button" variant="negative" size="sm" :text="$t('limits.sheet.deleteYes')" data-test="goal-delete" @click="emit('delete', start.id)" />
            <VButton type="button" variant="secondary" size="sm" :text="$t('limits.sheet.cancel')" @click="confirming = false" />
          </span>
        </template>
      </div>
    </form>
  </VSheet>
</template>
