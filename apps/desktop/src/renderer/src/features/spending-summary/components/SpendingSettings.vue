<script setup lang="ts">
import { useId } from 'vue';
import { VPopover, VSwitch } from '@/shared/ui';
import type { SpendingPrefs } from '../types.ts';

const { prefs, family } = defineProps<{ prefs: Readonly<SpendingPrefs>; family: boolean }>();
const emit = defineEmits<{ set: [key: keyof SpendingPrefs, value: boolean] }>();
const id = useId();
</script>

<template>
  <VPopover icon="lucide:settings" :label="$t('home.spending.settings.button')">
    <div class="flex flex-col">
      <p class="px-2 pt-2 pb-1 text-xs font-semibold text-foreground-muted">{{ $t('home.spending.settings.bars') }}</p>
      <div v-if="family" class="flex items-center gap-3 rounded-lg px-2 py-2.5">
        <label :for="`${id}-split`" class="flex grow cursor-pointer flex-col gap-0.5">
          <span class="font-semibold">{{ $t('home.spending.settings.split') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('home.spending.settings.splitHint') }}</span>
        </label>
        <VSwitch :id="`${id}-split`" :model-value="prefs.split" role="switch" @update:model-value="emit('set', 'split', $event)" />
      </div>
      <div class="flex items-center gap-3 rounded-lg px-2 py-2.5">
        <label :for="`${id}-mark`" class="flex grow cursor-pointer flex-col gap-0.5">
          <span class="font-semibold">{{ $t('home.spending.settings.mark') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('home.spending.settings.markHint') }}</span>
        </label>
        <VSwitch :id="`${id}-mark`" :model-value="prefs.mark" role="switch" @update:model-value="emit('set', 'mark', $event)" />
      </div>
    </div>
  </VPopover>
</template>
