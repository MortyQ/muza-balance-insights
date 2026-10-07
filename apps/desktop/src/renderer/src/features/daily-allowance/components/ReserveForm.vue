<script setup lang="ts">
import { computed, ref } from 'vue';
import { RESERVE_AMOUNT_MAX, RESERVE_CURRENCIES, RESERVE_NAME_MAX, type ReserveCurrency, type ReserveInput } from '@contract/allowance.ts';
import { currencySymbol, t } from '@/shared/lib';
import { VButton, VCheckbox, VDatepicker, VInput, VSelect, type VSelectOption } from '@/shared/ui';
import { reserveMinor } from '../utils.ts';

const { start, owners, today, failed = false } = defineProps<{
  /** What the form starts from: a saved reserve, or a new one's defaults. */
  start: ReserveInput;
  /** Whom it can belong to (a family of several): the «Whose» field; empty — no field, `start`'s owner kept. */
  owners: ReadonlyArray<{ id: number; name: string }>;
  /** YYYY-MM-DD: the earliest last day offered. */
  today: string;
  /** The last save failed. */
  failed?: boolean;
}>();
const emit = defineEmits<{ save: [r: ReserveInput]; cancel: [] }>();

const name = ref(start.name);
const amount = ref(start.amount > 0 ? String(start.amount / 100) : '');
const currency = ref<ReserveCurrency>(start.currency);
const noEnd = ref(start.until === null);
const until = ref<string | null>(start.until);
const tried = ref(false);
// «Whose»: a person's id, or COMMON.
const COMMON = 'common';
const owner = ref<number | string>(start.participantId ?? COMMON);
const ownerOptions = computed<VSelectOption[]>(() => [
  ...owners.map((p) => ({ label: p.name, value: p.id })),
  { label: t('home.allowance.reserves.common'), value: COMMON },
]);

const currencies: VSelectOption[] = RESERVE_CURRENCIES.map((c) => ({ label: currencySymbol(c), value: c }));
const minor = computed(() => reserveMinor(amount.value, RESERVE_AMOUNT_MAX));
const nameOk = computed(() => {
  const n = [...name.value.trim()].length;
  return n >= 1 && n <= RESERVE_NAME_MAX;
});
const nameError = computed(() => (tried.value && !nameOk.value ? t('home.allowance.reserves.nameInvalid', { max: RESERVE_NAME_MAX }) : ''));
const amountError = computed(() => (tried.value && minor.value === null ? t('home.allowance.reserves.amountInvalid') : ''));
const dateError = computed(() => (tried.value && !noEnd.value && until.value === null ? t('home.allowance.reserves.dateMissing') : ''));

function save() {
  tried.value = true;
  if (!nameOk.value || minor.value === null || (!noEnd.value && until.value === null)) return;
  const participantId = typeof owner.value === 'number' ? owner.value : null;
  emit('save', { name: name.value.trim(), currency: currency.value, amount: minor.value, until: noEnd.value ? null : until.value, participantId });
}
</script>

<template>
  <form class="flex flex-col gap-3 rounded-lg border border-border-subtle p-3" @submit.prevent="save">
    <VInput
      v-model="name"
      :label="$t('home.allowance.reserves.name')"
      :placeholder="$t('home.allowance.reserves.namePlaceholder')"
      :show-clear-button="false"
      :error="nameError"
    />
    <div class="flex flex-wrap items-start gap-2">
      <!-- VInput's own wrapper takes the full width: the width is set here. -->
      <div class="w-36">
        <VInput v-model="amount" :label="$t('home.allowance.reserves.amount')" :show-clear-button="false" :error="amountError" />
      </div>
      <VSelect v-model="currency" :options="currencies" :label="$t('home.allowance.reserves.currency')" class="w-24" />
    </div>
    <VSelect v-if="owners.length > 0" v-model="owner" :options="ownerOptions" :label="$t('home.allowance.reserves.owner')" class="w-full max-w-72" />
    <div class="flex flex-col gap-2">
      <VCheckbox v-model="noEnd" :label="$t('home.allowance.reserves.noEndLabel')" />
      <VDatepicker v-if="!noEnd" v-model="until" :label="$t('home.allowance.reserves.lastDay')" :min="today" class="w-56" />
      <p v-if="dateError" class="text-xs text-danger">{{ dateError }}</p>
    </div>
    <p class="text-xs text-foreground-muted">{{ $t('home.allowance.reserves.hint') }}</p>
    <p v-if="failed" class="text-xs text-danger">{{ $t('home.allowance.reserves.failed') }}</p>
    <div class="flex gap-2">
      <VButton type="submit" variant="primary" size="sm" :text="$t('home.allowance.reserves.save')" />
      <VButton type="button" variant="secondary" size="sm" :text="$t('home.allowance.reserves.cancel')" @click="emit('cancel')" />
    </div>
  </form>
</template>
