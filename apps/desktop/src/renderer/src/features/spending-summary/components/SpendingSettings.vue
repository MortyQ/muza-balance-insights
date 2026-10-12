<script setup lang="ts">
import { VPopover } from '@/shared/ui';
import type { SpendingPrefs } from '../types.ts';
import PrefSwitch from './PrefSwitch.vue';

const { prefs, family } = defineProps<{ prefs: Readonly<SpendingPrefs>; family: boolean }>();
const emit = defineEmits<{ set: [key: keyof SpendingPrefs, value: boolean] }>();
</script>

<template>
  <VPopover icon="lucide:settings" :label="$t('home.spending.settings.button')">
    <div class="flex flex-col">
      <p class="px-2 pt-2 pb-1 text-xs font-semibold text-foreground-muted">{{ $t('home.spending.settings.bars') }}</p>
      <PrefSwitch
        v-if="family"
        :model-value="prefs.split"
        :title="$t('home.spending.settings.split')"
        :hint="$t('home.spending.settings.splitHint')"
        @update:model-value="emit('set', 'split', $event)"
      />
      <PrefSwitch
        :model-value="prefs.mark"
        :title="$t('home.spending.settings.mark')"
        :hint="$t('home.spending.settings.markHint')"
        @update:model-value="emit('set', 'mark', $event)"
      />
    </div>
  </VPopover>
</template>
