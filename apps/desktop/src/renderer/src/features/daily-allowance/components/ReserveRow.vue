<script setup lang="ts">
import { ref } from 'vue';
import { VAvatar, VPopover } from '@/shared/ui';
import type { ReserveRowView } from '../types.ts';

const { row } = defineProps<{ row: ReserveRowView }>();
const emit = defineEmits<{ edit: [id: number]; delete: [id: number] }>();

const open = ref(false);
function pick(what: 'edit' | 'delete') {
  open.value = false;
  if (what === 'edit') emit('edit', row.id);
  else emit('delete', row.id);
}
</script>

<template>
  <li class="flex items-center gap-3 py-2" :class="{ 'opacity-60': !row.active }">
    <span class="flex min-w-0 grow flex-col">
      <span class="truncate font-semibold" :title="row.name">{{ row.name }}</span>
      <span class="flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted">
        <template v-if="row.owner">
          <template v-if="'common' in row.owner">{{ $t('home.allowance.reserves.commonShort') }} ·</template>
          <template v-else>
            <VAvatar :name="row.owner.name" :color="row.owner.color" size="sm" :custom-size="16" aria-hidden="true" />
            <span class="truncate">{{ row.owner.name }} ·</span>
          </template>
        </template>
        <span class="shrink-0">{{ row.term }}</span>
      </span>
    </span>
    <span class="flex shrink-0 flex-col items-end gap-0.5">
      <span class="whitespace-nowrap font-bold tabular-nums">{{ row.amount }}</span>
      <span v-if="row.approx" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ row.approx }}</span>
    </span>
    <VPopover v-model:open="open" icon="lucide:ellipsis" :label="$t('home.allowance.reserves.actions', { name: row.name })">
      <div class="flex flex-col">
        <button
          v-for="a in (['edit', 'delete'] as const)"
          :key="a"
          type="button"
          class="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
          @click="pick(a)"
        >
          {{ a === 'edit' ? $t('home.allowance.reserves.edit') : $t('home.allowance.reserves.delete') }}
        </button>
      </div>
    </VPopover>
  </li>
</template>
