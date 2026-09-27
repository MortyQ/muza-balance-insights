<script setup lang="ts">
import { nextTick, useId, useTemplateRef } from 'vue';
import type { SettingsSection } from '@/shared/config';
import { VIcon } from '@/shared/ui';
import { NAV_GROUPS, NAV_LABEL_CLASS } from '../constants.ts';
import { nextSection } from '../utils.ts';

const { current } = defineProps<{ current: SettingsSection }>();
const emit = defineEmits<{ select: [section: SettingsSection] }>();

const nav = useTemplateRef<HTMLElement>('nav');
const groupId = useId();
const STEP: Record<string, 1 | -1> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

async function onKey(e: KeyboardEvent) {
  const delta = STEP[e.key];
  if (!delta) return;
  e.preventDefault();
  const next = nextSection(current, delta);
  emit('select', next);
  await nextTick();
  nav.value?.querySelector<HTMLButtonElement>(`[data-section="${next}"]`)?.focus();
}
</script>

<template>
  <nav
    ref="nav"
    aria-label="Разделы настроек"
    class="sticky top-0 z-1 -mx-4 flex gap-2 overflow-x-auto border-b border-border-subtle bg-background px-4 py-2 [scrollbar-width:none] min-[45rem]:top-6 min-[45rem]:mx-0 min-[45rem]:flex-col min-[45rem]:gap-4 min-[45rem]:overflow-visible min-[45rem]:border-0 min-[45rem]:p-0"
    @keydown="onKey"
  >
    <div
      v-for="(group, g) in NAV_GROUPS"
      :key="group.label"
      role="group"
      :aria-labelledby="`${groupId}-${g}`"
      class="flex items-center gap-0.5 min-[45rem]:flex-col min-[45rem]:items-stretch [&+&]:border-l [&+&]:border-border [&+&]:pl-2 min-[45rem]:[&+&]:border-0 min-[45rem]:[&+&]:pl-0"
    >
      <div
        :id="`${groupId}-${g}`"
        :class="NAV_LABEL_CLASS"
      >
        {{ group.label }}
      </div>
      <button
        v-for="item in group.items"
        :key="item.label"
        type="button"
        :data-section="item.section ?? undefined"
        :aria-current="item.section === current ? 'page' : undefined"
        :aria-disabled="item.section === null ? 'true' : undefined"
        :title="item.section === null ? 'Появится позже' : undefined"
        :tabindex="item.section === current ? undefined : -1"
        class="group relative flex h-(--control-h-md) shrink-0 cursor-pointer items-center gap-2 rounded-md px-(--control-px) text-left font-medium whitespace-nowrap text-foreground-secondary transition-colors duration-120 before:absolute before:inset-y-1.5 before:left-0 before:hidden before:w-0.5 before:scale-y-0 before:rounded-sm before:bg-primary before:transition-transform before:duration-160 before:ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-surface-hover hover:text-foreground motion-reduce:before:transition-none min-[45rem]:before:block aria-[current=page]:bg-primary-subtle aria-[current=page]:font-semibold aria-[current=page]:text-primary aria-[current=page]:before:scale-y-100 aria-disabled:cursor-default aria-disabled:text-foreground-disabled aria-disabled:hover:bg-transparent aria-disabled:hover:text-foreground-disabled"
        @click="item.section && emit('select', item.section)"
      >
        <VIcon
          :icon="item.icon"
          :size="16"
          class="text-foreground-muted group-aria-[current=page]:text-primary group-aria-disabled:text-foreground-disabled"
        />
        {{ item.label }}
        <span
          v-if="item.section === null"
          class="ml-auto inline-flex h-5 items-center rounded-full bg-badge-neutral-bg px-2 text-xs font-semibold text-badge-neutral-text"
        >
          Скоро
        </span>
      </button>
    </div>
  </nav>
</template>
