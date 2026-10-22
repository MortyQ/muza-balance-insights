<!-- copied from muzakit/libs/ui/src (2026-10-22); changes: ui/README.md -->
<script lang="ts" setup>
import { useTemplateRef } from "vue";

import { useSidebarState } from "../composables/useSidebarState";

import SidebarNavItem from "./SidebarNavItem.vue";

const {
  resolvedItems,
  isCollapsed,
  expandedItems,
  activeItemId,
  options,
} = useSidebarState();

// Balance: arrow keys move between the entries and open the one moved to, as the app's previous side menu did
const list = useTemplateRef<HTMLElement>("list");
const STEP: Record<string, 1 | -1> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

function onKeydown(e: KeyboardEvent): void {
  const delta = STEP[e.key];
  if (!delta || !list.value) return;
  const entries = [...list.value.querySelectorAll<HTMLElement>(".sidebar-item:not(:disabled)")];
  const from = entries.findIndex(el => el === document.activeElement);
  if (from < 0) return;
  e.preventDefault();
  const next = entries[(from + delta + entries.length) % entries.length];
  next?.focus();
  next?.click();
}
</script>

<template>
  <nav
    :class="{ 'sidebar-nav--collapsed': isCollapsed }"
    :aria-label="options.labels().nav"
    class="sidebar-nav"
    @keydown="onKeydown"
  >
    <div
      ref="list"
      class="sidebar-nav__list"
    >
      <!--
        v-memo: items re-render only when active route, expand state or collapse
        changes. Keyed on the Set itself, not its size — toggleExpanded and
        expandMany reassign a new Set on every change, whereas `size` stays equal
        when one branch opens and another closes in the same tick.
      -->
      <SidebarNavItem
        v-for="item in resolvedItems"
        :key="item.id"
        v-memo="[activeItemId, expandedItems, isCollapsed, item.id]"
        :item="item"
        :level="0"
      />
    </div>
  </nav>
</template>
