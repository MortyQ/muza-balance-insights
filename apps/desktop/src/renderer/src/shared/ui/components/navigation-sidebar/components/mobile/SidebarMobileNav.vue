<!-- copied from muzakit/libs/ui/src (2026-10-22); changes: ui/README.md -->
<script lang="ts" setup>
import { useSidebarState } from "../../composables/useSidebarState";

import SidebarMobileNavItem from "./SidebarMobileNavItem.vue";

const { resolvedItems, expandedItems, activeItemId, options } = useSidebarState();
</script>

<template>
  <nav
    :aria-label="options.labels().nav"
    class="sidebar-mobile-nav"
  >
    <SidebarMobileNavItem
      v-for="item in resolvedItems"
      :key="item.id"
      v-memo="[activeItemId, expandedItems, item.id]"
      :item="item"
      :level="0"
    />
  </nav>
</template>
