<script setup lang="ts">
import { computed, useId } from 'vue';
import { t } from '@/shared/lib';
import { VPopover, VSegmentedControl } from '@/shared/ui';
import { SPLITS } from '../constants.ts';
import type { SpendingPrefs, SpendingSplit } from '../types.ts';
import PrefSwitch from './PrefSwitch.vue';

/** `family` — two or more people in the view; `banks` — two or more banks on in the bank filter. */
const { prefs, family, banks } = defineProps<{ prefs: Readonly<SpendingPrefs>; family: boolean; banks: boolean }>();
const emit = defineEmits<{ set: [key: 'split', value: SpendingSplit] | [key: 'mark', value: boolean] }>();
const id = useId();

const LABELS = { together: 'home.spending.settings.splitTogether', people: 'home.spending.settings.splitPeople', banks: 'home.spending.settings.splitBanks' } as const;
// Only the splits that apply; the stored choice stays as it is while its option is hidden (spec desktop-spending-split).
const options = computed(() => SPLITS.filter((s) => s === 'together' || (s === 'people' ? family : banks)).map((value) => ({ value, label: t(LABELS[value]) })));
const shown = computed<SpendingSplit>(() => (options.value.some((o) => o.value === prefs.split) ? prefs.split : 'together'));
</script>

<template>
  <VPopover icon="lucide:settings" :label="$t('home.spending.settings.button')">
    <div class="flex flex-col">
      <p class="px-2 pt-2 pb-1 text-xs font-semibold text-foreground-muted">{{ $t('home.spending.settings.bars') }}</p>
      <div v-if="options.length > 1" class="flex flex-col gap-2 rounded-lg px-2 py-2.5">
        <span :id class="flex flex-col gap-0.5">
          <span class="font-semibold">{{ $t('home.spending.settings.split') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('home.spending.settings.splitHint') }}</span>
        </span>
        <VSegmentedControl
          :model-value="shown"
          :options
          size="sm"
          full-width
          role="group"
          :aria-labelledby="id"
          @update:model-value="emit('set', 'split', $event)"
        />
      </div>
      <PrefSwitch
        :model-value="prefs.mark"
        :title="$t('home.spending.settings.mark')"
        :hint="$t('home.spending.settings.markHint')"
        @update:model-value="emit('set', 'mark', $event)"
      />
    </div>
  </VPopover>
</template>
