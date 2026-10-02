<script setup lang="ts">
import { useId } from 'vue';
import { VIcon } from '@/shared/ui';
import type { RowView } from '../types.ts';
import ChangeChip from './ChangeChip.vue';

const { row, expandable, open } = defineProps<{ row: RowView; expandable: boolean; open: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
const panelId = useId();
const OPS_TONE = {
  up: 'text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]',
  down: 'text-[color-mix(in_oklch,var(--series-blue)_72%,var(--foreground))]',
  neutral: 'text-foreground-muted',
} as const;
</script>

<template>
  <div class="flex flex-col rounded-xl" :class="{ 'bg-surface-raised': open }">
    <component
      :is="expandable ? 'button' : 'div'"
      :type="expandable ? 'button' : undefined"
      :aria-expanded="expandable ? open : undefined"
      :aria-controls="expandable ? panelId : undefined"
      class="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left"
      :class="{ 'cursor-pointer hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus': expandable }"
      @click="expandable && emit('toggle')"
    >
      <VIcon :icon="row.icon" :color="row.color" class="size-4 shrink-0" />
      <span class="flex min-w-0 grow flex-col gap-1.5">
        <span class="flex min-w-0 items-baseline justify-between gap-2.5">
          <span class="min-w-0 truncate font-semibold" :title="row.name">{{ row.name }}</span>
          <span class="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-xs tabular-nums" :title="row.ops.title">
            <span class="text-foreground-muted">{{ row.ops.text }}</span>
            <span v-if="row.ops.diff" class="font-bold" :class="OPS_TONE[row.ops.tone]">{{ row.ops.diff }}</span>
          </span>
        </span>
        <span class="flex items-center gap-2.5">
          <span class="relative block h-1 grow">
            <span class="absolute inset-y-0 left-0 flex w-(--w) gap-0.5" :style="{ '--w': `${row.width}%` }">
              <span v-for="(s, i) in row.segments" :key="i" class="block grow-(--g) basis-0 rounded-sm bg-(--s)" :style="{ '--g': s.value, '--s': s.color }" :title="s.title" />
            </span>
            <span v-if="row.mark !== null" class="absolute -top-1 left-(--m) -ms-px h-3 w-0.5 rounded-sm bg-foreground" :style="{ '--m': `${row.mark}%` }" :title="row.markTitle" />
          </span>
          <span class="w-8 shrink-0 whitespace-nowrap text-right text-xs text-foreground-muted tabular-nums">{{ row.share }}</span>
        </span>
      </span>
      <span class="flex w-25 shrink-0 flex-col items-end gap-px">
        <span class="whitespace-nowrap font-bold tabular-nums">{{ row.amount }}</span>
        <span v-for="c in row.conv" :key="c" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ c }}</span>
      </span>
      <span class="flex w-22.5 shrink-0 justify-end"><ChangeChip v-if="row.chip" :chip="row.chip" size="sm" /></span>
      <VIcon
        v-if="expandable"
        icon="lucide:chevron-right"
        class="size-3.5 shrink-0 text-foreground-muted transition-transform motion-reduce:transition-none"
        :class="{ 'rotate-90': open }"
      />
    </component>
    <div v-if="expandable && open" :id="panelId" class="flex flex-col gap-0.5 pe-2.5 pb-2.5 ps-9">
      <div v-for="p in row.people" :key="p.participantId" class="flex min-h-7.5 flex-wrap items-center gap-x-2 gap-y-1 py-0.5 @xl:flex-nowrap" :class="{ 'opacity-45': p.faded }">
        <span class="grid size-5.5 shrink-0 place-items-center rounded-full bg-(--c) text-xs font-extrabold text-white" :style="{ '--c': p.color }" aria-hidden="true">{{ p.initial }}</span>
        <span class="min-w-0 grow truncate text-xs text-foreground-secondary @xl:w-13 @xl:shrink-0 @xl:grow-0" :title="p.name">{{ p.name }}</span>
        <span class="relative order-last h-2 basis-full rounded-full bg-surface-sunken @xl:order-none @xl:min-w-12 @xl:grow @xl:basis-0">
          <span class="absolute inset-y-0 left-0 w-(--w) rounded-full bg-(--c)" :style="{ '--w': `${p.width}%`, '--c': p.color }" />
          <span v-if="p.mark !== null" class="absolute -top-1 left-(--m) -ms-px h-4 w-0.5 rounded-sm bg-foreground" :style="{ '--m': `${p.mark}%` }" :title="p.markTitle" />
        </span>
        <span class="w-18 shrink-0 whitespace-nowrap text-right text-xs text-foreground-muted tabular-nums" :title="p.ops.title">
          {{ p.ops.text }} <span v-if="p.ops.diff" class="font-bold" :class="OPS_TONE[p.ops.tone]">{{ p.ops.diff }}</span>
        </span>
        <span class="flex w-22 shrink-0 flex-col items-end gap-px">
          <span class="whitespace-nowrap font-bold tabular-nums">{{ p.amount }}</span>
          <span v-for="c in p.conv" :key="c" class="whitespace-nowrap text-xs text-foreground-muted tabular-nums">{{ c }}</span>
        </span>
        <span class="flex w-21 shrink-0 justify-end"><ChangeChip v-if="p.chip" :chip="p.chip" size="sm" /></span>
      </div>
    </div>
  </div>
</template>
