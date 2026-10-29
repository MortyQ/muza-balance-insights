<script setup lang="ts">
import { computed, useId } from 'vue';
import { t } from '@/shared/lib';
import { VPopover, VSegmentedControl } from '@/shared/ui';
import type { PaceSplit } from '../types.ts';

const { split } = defineProps<{ split: PaceSplit }>();
const emit = defineEmits<{ split: [value: PaceSplit] }>();
const id = useId();
const options = computed(() => [
  { value: 'together' as PaceSplit, label: t('home.balances.pace.settings.together') },
  { value: 'banks' as PaceSplit, label: t('home.balances.pace.settings.banks') },
]);
</script>

<template>
  <VPopover icon="lucide:settings" :label="$t('home.balances.pace.settings.button')">
    <div class="flex flex-col gap-2 rounded-lg px-2 py-2.5">
      <span :id class="flex flex-col gap-0.5">
        <span class="font-semibold">{{ $t('home.balances.pace.settings.split') }}</span>
        <span class="text-xs text-foreground-muted">{{ $t('home.balances.pace.settings.splitHint') }}</span>
      </span>
      <VSegmentedControl
        :model-value="split"
        :options
        size="sm"
        full-width
        role="group"
        :aria-labelledby="id"
        @update:model-value="emit('split', $event)"
      />
    </div>
  </VPopover>
</template>
