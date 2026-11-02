<script setup lang="ts">
import { computed } from 'vue';
import type { CategoryKind } from '@contract/api.ts';
import { KINDS } from '@/entities/category-kind';
import { t } from '@/shared/lib';
import { VIcon, VSegmentedControl, VSwitch } from '@/shared/ui';
import type { CategoryKindRowView } from '../types.ts';

const { row } = defineProps<{ row: CategoryKindRowView }>();
const emit = defineEmits<{ change: [next: { kind: CategoryKind; fixed: boolean }] }>();

const options = computed(() => KINDS.map((k) => ({ value: k.kind, label: t(k.label) })));
const kind = computed<CategoryKind>({ get: () => row.kind, set: (next) => emit('change', { kind: next, fixed: row.fixed }) });
const fixed = computed<boolean>({ get: () => row.fixed, set: (next) => emit('change', { kind: row.kind, fixed: next }) });
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-test="kind-row">
    <div class="flex min-w-48 flex-1 items-center gap-3">
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-foreground-secondary">
        <VIcon :icon="row.icon" class="size-4" />
      </span>
      <span class="truncate font-semibold">{{ row.name }}</span>
      <span v-if="row.changed" class="rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-semibold text-primary" data-test="kind-changed">
        {{ $t('settings.categoryKinds.changed') }}
      </span>
      <span v-if="row.notCounted" class="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-foreground-muted" data-test="kind-not-counted">
        {{ $t('settings.categoryKinds.notCounted') }}
      </span>
    </div>
    <VSegmentedControl v-model="kind" :options size="sm" :aria-label="$t('settings.categoryKinds.kindOf', { name: row.name })" />
    <span class="flex items-center gap-2 text-sm text-foreground-secondary">
      <span aria-hidden="true">{{ $t('settings.categoryKinds.fixed') }}</span>
      <VSwitch v-model="fixed" :aria-label="$t('settings.categoryKinds.fixedOf', { name: row.name })" />
    </span>
  </div>
</template>
