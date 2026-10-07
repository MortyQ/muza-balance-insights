<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { ALLOWANCE_RESERVE_MAX } from '@contract/allowance.ts';
import { currencySymbol, t } from '@/shared/lib';
import { VButton, VInput } from '@/shared/ui';
import type { ReserveFieldValue } from '../types.ts';
import { reserveMinor } from '../utils.ts';

const { saved, failed = false } = defineProps<{
  /** The saved reserve in whole units of the field's currency. */
  saved: ReserveFieldValue;
  /** The last save failed. */
  failed?: boolean;
}>();
const emit = defineEmits<{ save: [amount: number] }>();

const id = useId();
const text = ref(String(saved.units));
const invalid = ref(false);
watch(
  () => saved.units,
  (v) => (text.value = String(v)),
);
const error = computed(() => (invalid.value ? t('home.allowance.reserveInvalid') : failed ? t('home.allowance.reserveFailed') : ''));

function save() {
  const k = reserveMinor(String(text.value ?? ''), ALLOWANCE_RESERVE_MAX);
  invalid.value = k === null;
  if (k !== null) emit('save', k);
}
</script>

<template>
  <form class="flex flex-col gap-1.5" @submit.prevent="save">
    <label :for="id" class="text-sm font-semibold">{{ $t('home.allowance.reserveLabel') }}</label>
    <div class="flex items-start gap-2">
      <VInput :id v-model="text" type="text" size="sm" class="w-40" :show-clear-button="false" :error :helper-text="$t('home.allowance.reserveHint')" />
      <span class="pt-1.5 text-sm text-foreground-secondary">{{ currencySymbol(saved.currency) }}</span>
      <VButton type="submit" variant="secondary" size="sm" :text="$t('home.allowance.reserveSave')" />
    </div>
  </form>
</template>
