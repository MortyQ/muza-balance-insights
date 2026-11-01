<script setup lang="ts">
import { computed } from 'vue';
import { formatMoney, monthShortName, t } from '@/shared/lib';

// The past whole months against an amount (a sheet's preview): a bar per month, oldest first, warning-coloured where it
// would have gone over, the amount as a dashed line; how many months would have gone over in words.
const { months, amount, currency } = defineProps<{
  months: ReadonlyArray<{ month: string; minor: number }>;
  /** Minor units of `currency`; null — nothing typed yet. */
  amount: number | null;
  currency: number;
}>();
const bars = computed(() => {
  const list = [...months].reverse();
  const top = Math.max(amount ?? 0, ...list.map((m) => m.minor), 1) * 1.1;
  return {
    list: list.map((m) => ({ ...m, height: (m.minor / top) * 100, over: amount !== null && m.minor > amount, label: monthShortName(Number(m.month.slice(5, 7))) })),
    line: amount !== null ? (amount / top) * 100 : null,
  };
});
const over = computed(() => bars.value.list.filter((b) => b.over).length);
</script>

<template>
  <figure v-if="months.length > 0" class="flex flex-col gap-2" data-test="past-bars">
    <div class="relative flex h-28 items-end gap-2" aria-hidden="true">
      <div v-for="b in bars.list" :key="b.month" class="flex flex-1 flex-col items-center gap-1">
        <div class="w-full rounded-md" :class="b.over ? 'bg-warning' : 'bg-primary/70'" :style="{ height: `${b.height}%` }" :title="`${b.label}: ${formatMoney(b.minor, currency)}`" />
      </div>
      <div v-if="bars.line !== null" class="absolute inset-x-0 border-t border-dashed border-foreground/60" :style="{ bottom: `${bars.line}%` }" />
    </div>
    <div class="flex gap-2 text-[0.625rem] text-foreground-muted" aria-hidden="true">
      <span v-for="b in bars.list" :key="b.month" class="flex-1 text-center">{{ b.label }}</span>
    </div>
    <figcaption class="text-xs text-foreground-muted" data-test="past-note">
      {{ amount === null ? t('limits.sheet.previewEmpty') : over === 0 ? t('limits.sheet.previewNone', { n: bars.list.length }) : t('limits.sheet.previewOver', { over, n: bars.list.length }) }}
    </figcaption>
  </figure>
</template>
