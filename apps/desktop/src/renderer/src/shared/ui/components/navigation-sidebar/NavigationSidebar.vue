<!-- copied from muzakit/libs/ui/src (2026-10-22); changes: ui/README.md -->
<script lang="ts" setup>
import { computed, defineAsyncComponent, provide, watch } from "vue";

import type { RouteLocationRaw } from "vue-router";

import SidebarFooter from "./components/SidebarFooter.vue";
import SidebarHeader from "./components/SidebarHeader.vue";
import SidebarNav from "./components/SidebarNav.vue";
import { SIDEBAR_STATE_KEY } from "./composables/injectionKeys";
import { useNavigation } from "./composables/useNavigation";
import { buildSidebarState } from "./composables/useSidebarState";
import type { SidebarInstance, SidebarNavItem } from "./types";

const { sidebar, footerItems = [] } = defineProps<{
  /** Sidebar instance created via createSidebar() */
  sidebar: SidebarInstance
  /** Balance: entries in the footer (muzakit's SidebarFooter takes them, its NavigationSidebar did not pass them) */
  footerItems?: SidebarNavItem[]
}>();

const emit = defineEmits<{
  /** Fired when user hovers a nav item — consumer calls prefetchRoute(to) */
  prefetch: [to: RouteLocationRaw]
  /** Fired when collapsed state changes */
  collapse: [value: boolean]
  /** Fired when a nav item is clicked */
  "item-click": [item: SidebarNavItem]
}>();

const SidebarMobile = defineAsyncComponent(
  () => import("./NavigationSidebarMobile.vue"),
);

// Build per-instance state from the factory instance
const state = buildSidebarState(sidebar);

// Per-instance navigation resolver — NO module-level refs
const { activeItemId, activePathIds, isActive, isOnActivePath } = useNavigation(
  state.resolvedItems,
);

// Provide full state to entire component subtree via typed Symbol key
provide(SIDEBAR_STATE_KEY, {
  ...state,
  activeItemId,
  activePathIds,
  isActive,
  isOnActivePath,
  onPrefetch: (to: RouteLocationRaw) => emit("prefetch", to),
});

const { isCollapsed } = state;
const labels = computed(() => sidebar.options.labels());

// Reveal where you are: open every ancestor of the active route. A side effect
// on a route change, not a synchroniser — expandMany only adds, so collapsing
// the active parent by hand sticks until the active path itself changes.
// `immediate` is what makes a deep link to a nested page land with its branch open.
watch(
  activePathIds,
  (ids) => { state.expandMany([...ids]); },
  { immediate: true },
);
</script>

<template>
  <div>
    <!-- Desktop sidebar — hidden on small screens -->
    <aside
      :class="{ 'sidebar--collapsed': isCollapsed }"
      :aria-label="labels.nav"
      class="sidebar sidebar--flat"
    >
      <SidebarHeader>
        <template
          v-if="$slots['header-end']"
          #end
        >
          <slot name="header-end" />
        </template>
      </SidebarHeader>

      <!-- #subtitle-block — context between the brand and the menu (workspace, account) -->
      <div
        v-if="$slots['subtitle-block']"
        class="sidebar-context"
      >
        <slot name="subtitle-block" />
      </div>

      <SidebarNav />

      <SidebarFooter :items="footerItems">
        <template
          v-if="$slots['footer-start']"
          #start
        >
          <slot name="footer-start" />
        </template>
        <template
          v-if="$slots['footer-end']"
          #end
        >
          <slot name="footer-end" />
        </template>
      </SidebarFooter>
    </aside>

    <!-- Mobile sidebar (lazy loaded — desktop users don't download this) -->
    <SidebarMobile :footer-items="footerItems">
      <template
        v-if="$slots['subtitle-block']"
        #context
      >
        <slot name="subtitle-block" />
      </template>
      <template
        v-if="$slots['footer-start']"
        #start
      >
        <slot name="footer-start" />
      </template>
      <template
        v-if="$slots['footer-end']"
        #end
      >
        <slot name="footer-end" />
      </template>
    </SidebarMobile>
  </div>
</template>

<style lang="scss">
@use '../../styles/components/navigation-sidebar/sidebar.scss';
</style>
