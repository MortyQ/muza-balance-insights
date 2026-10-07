<script setup lang="ts">
import { computed, ref } from 'vue';
import type { RecurringMark } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { VAvatar, VIcon, VPopover } from '@/shared/ui';
import type { RecurringRowView } from '../types.ts';

const { row, hidden = false } = defineProps<{
  row: RecurringRowView;
  /** A row of the hidden list: «Restore» instead of the menu. */
  hidden?: boolean;
}>();
const emit = defineEmits<{ mark: [key: string, mark: RecurringMark | null] }>();

const open = ref(false);
const actions = computed((): Array<{ text: string; mark: RecurringMark | null }> => [
  row.mandatory ? { text: t('recurring.unmarkMandatory'), mark: null } : { text: t('recurring.markMandatory'), mark: 'mandatory' },
  { text: t('recurring.hide'), mark: 'hidden' },
]);
function pick(mark: RecurringMark | null) {
  open.value = false;
  emit('mark', row.key, mark);
}
</script>

<template>
  <li class="flex min-h-14 items-center gap-3 py-2">
    <span class="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-foreground-secondary" aria-hidden="true">
      <VIcon :icon="row.icon" class="size-4.5" />
    </span>
    <span class="flex min-w-0 grow flex-col">
      <span class="truncate font-semibold" :title="row.name">{{ row.name }}</span>
      <span class="flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted">
        <VAvatar v-if="row.person" :name="row.person.name" :color="row.person.color" size="sm" :custom-size="16" aria-hidden="true" />
        <span class="truncate">{{ row.caption }}</span>
        <span v-if="row.mandatory" class="shrink-0 rounded-full bg-surface-sunken px-1.5 font-semibold text-foreground-secondary">
          {{ $t('recurring.mandatory') }}
        </span>
      </span>
    </span>
    <span class="flex shrink-0 flex-col items-end gap-0.5">
      <span class="whitespace-nowrap font-bold tabular-nums">{{ row.amount }}</span>
      <span v-if="row.operation" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ row.operation }}</span>
      <span class="whitespace-nowrap text-xs text-foreground-muted">{{ row.when }}</span>
    </span>
    <button
      v-if="hidden"
      type="button"
      class="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
      @click="emit('mark', row.key, null)"
    >
      {{ $t('recurring.restore') }}
    </button>
    <VPopover v-else v-model:open="open" icon="lucide:ellipsis" :label="$t('recurring.actions', { name: row.name })">
      <div class="flex flex-col">
        <button
          v-for="a in actions"
          :key="a.text"
          type="button"
          class="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
          @click="pick(a.mark)"
        >
          {{ a.text }}
        </button>
      </div>
    </VPopover>
  </li>
</template>
