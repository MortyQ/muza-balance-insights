<script setup lang="ts">
import { computed } from 'vue';
import type { Scope } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { VSegmentedControl } from '@/shared/ui';
import { SCOPES } from '../constants.ts';
import type { SpendingPrefs, SpendingSplit } from '../types.ts';
import SpendingSettings from './SpendingSettings.vue';

const { subtitle, prefs, family, banks } = defineProps<{ subtitle: string; prefs: Readonly<SpendingPrefs>; family: boolean; banks: boolean }>();
const scope = defineModel<Scope>('scope', { required: true });
const emit = defineEmits<{ set: [key: 'split', value: SpendingSplit] | [key: 'mark', value: boolean] }>();
const scopes = computed(() => SCOPES.map((s) => ({ ...s, label: t(s.label) })));
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex min-w-0 items-baseline gap-2.5">
      <h3 class="text-base font-bold">{{ $t('home.spending.title') }}</h3>
      <span class="truncate text-sm text-foreground-muted">{{ subtitle }}</span>
    </div>
    <div class="flex items-center gap-2">
      <VSegmentedControl v-model="scope" :options="scopes" />
      <SpendingSettings :prefs :family :banks @set="(...a) => emit('set', ...a)" />
    </div>
  </div>
</template>
