<script setup lang="ts">
import { computed } from 'vue';
import type { Scope, SpendingFx } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { VSegmentedControl } from '@/shared/ui';
import { SCOPES } from '../constants.ts';
import type { SpendingPrefs } from '../types.ts';
import SpendingSettings from './SpendingSettings.vue';

const { subtitle, prefs, family, fx } = defineProps<{ subtitle: string; prefs: Readonly<SpendingPrefs>; family: boolean; fx: ReadonlyArray<SpendingFx> }>();
const scope = defineModel<Scope>('scope', { required: true });
const emit = defineEmits<{ set: [key: keyof SpendingPrefs, value: boolean] }>();
const scopes = computed(() => SCOPES.map((s) => ({ ...s, label: t(s.label) })));
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex min-w-0 items-baseline gap-2.5">
      <h3 class="m-0 text-[15px] font-bold">{{ $t('home.spending.title') }}</h3>
      <span class="truncate text-sm text-foreground-muted">{{ subtitle }}</span>
    </div>
    <div class="flex items-center gap-2">
      <VSegmentedControl v-model="scope" :options="scopes" />
      <SpendingSettings :prefs :family :fx @set="(k, v) => emit('set', k, v)" />
    </div>
  </div>
</template>
