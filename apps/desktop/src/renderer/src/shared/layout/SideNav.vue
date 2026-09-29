<script setup lang="ts" generic="T extends string">
import { nextTick, useId, useTemplateRef } from 'vue';
import type { MessageKey } from '@contract/i18n/index.ts';
import { VIcon } from '@/shared/ui';
import { SIDE_NAV_LABEL_CLASS } from './constants.ts';
import type { SideNavGroup } from './types.ts';
import { nextItem } from './utils.ts';

const { groups, current, label } = defineProps<{
  groups: ReadonlyArray<SideNavGroup<T>>;
  current: T;
  /** Dictionary key of the menu's name for screen readers. */
  label: MessageKey;
}>();
const emit = defineEmits<{ select: [id: T] }>();

const nav = useTemplateRef<HTMLElement>('nav');
const groupId = useId();
const STEP: Record<string, 1 | -1> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

async function onKey(e: KeyboardEvent) {
  const delta = STEP[e.key];
  if (!delta) return;
  e.preventDefault();
  const next = nextItem(groups, current, delta);
  emit('select', next);
  await nextTick();
  nav.value?.querySelector<HTMLButtonElement>(`[data-item="${next}"]`)?.focus();
}
</script>

<template>
  <nav
    ref="nav"
    :aria-label="$t(label)"
    class="sticky top-0 z-1 -mx-4 flex gap-2 overflow-x-auto border-b border-border-subtle bg-background px-4 py-2 [scrollbar-width:none] min-[45rem]:top-(--side-nav-top,1.5rem) min-[45rem]:mx-0 min-[45rem]:flex-col min-[45rem]:gap-4 min-[45rem]:overflow-visible min-[45rem]:border-0 min-[45rem]:p-0"
    @keydown="onKey"
  >
    <!-- Sticks 1.5rem below the top on wide windows; a screen with its own sticky bar above sets --side-nav-top. -->
    <div
      v-for="(group, g) in groups"
      :key="g"
      role="group"
      :aria-labelledby="group.label ? `${groupId}-${g}` : undefined"
      class="flex items-center gap-0.5 min-[45rem]:flex-col min-[45rem]:items-stretch [&+&]:border-l [&+&]:border-border [&+&]:pl-2 min-[45rem]:[&+&]:border-0 min-[45rem]:[&+&]:pl-0"
    >
      <div
        v-if="group.label"
        :id="`${groupId}-${g}`"
        :class="SIDE_NAV_LABEL_CLASS"
      >
        {{ $t(group.label) }}
      </div>
      <button
        v-for="item in group.items"
        :key="item.label"
        type="button"
        :data-item="item.id ?? undefined"
        :aria-current="item.id === current ? 'page' : undefined"
        :aria-disabled="item.id === null ? 'true' : undefined"
        :title="item.id === null ? $t('common.sideNav.later') : undefined"
        :tabindex="item.id === current ? undefined : -1"
        class="group relative flex h-(--control-h-md) shrink-0 cursor-pointer items-center gap-2 rounded-md px-(--control-px) text-left font-medium whitespace-nowrap text-foreground-secondary transition-colors duration-120 before:absolute before:inset-y-1.5 before:left-0 before:hidden before:w-0.5 before:scale-y-0 before:rounded-sm before:bg-primary before:transition-transform before:duration-160 before:ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-surface-hover hover:text-foreground motion-reduce:before:transition-none min-[45rem]:before:block aria-[current=page]:bg-primary-subtle aria-[current=page]:font-semibold aria-[current=page]:text-primary aria-[current=page]:before:scale-y-100 aria-disabled:cursor-default aria-disabled:text-foreground-disabled aria-disabled:hover:bg-transparent aria-disabled:hover:text-foreground-disabled"
        @click="item.id !== null && emit('select', item.id)"
      >
        <VIcon
          :icon="item.icon"
          :size="16"
          class="text-foreground-muted group-aria-[current=page]:text-primary group-aria-disabled:text-foreground-disabled"
        />
        {{ $t(item.label) }}
        <span
          v-if="item.id === null"
          class="ml-auto inline-flex h-5 items-center rounded-full bg-badge-neutral-bg px-2 text-xs font-semibold text-badge-neutral-text"
        >
          {{ $t('common.sideNav.soon') }}
        </span>
      </button>
    </div>
  </nav>
</template>
