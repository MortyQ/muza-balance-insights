<!-- copied from muzakit/libs/ui/src (2026-10-22); changes: ui/README.md -->
<script lang="ts" setup>
import VIcon from "../../base/VIcon.vue";
import { useSidebarState } from "../composables/useSidebarState";

const { isCollapsed, isForcedCollapsed, toggleCollapse, options } = useSidebarState();

const brandInitial = options.brandName.charAt(0).toUpperCase();
</script>

<template>
  <div
    :class="{ 'sidebar-header--collapsed': isCollapsed }"
    class="sidebar-header"
  >
    <!-- Brand (hidden when collapsed) -->
    <Transition
      enter-active-class="sidebar-label-enter-active"
      enter-from-class="sidebar-label-enter-from"
      enter-to-class="sidebar-label-enter-to"
      leave-active-class="sidebar-label-leave-active"
      leave-from-class="sidebar-label-leave-from"
      leave-to-class="sidebar-label-leave-to"
    >
      <div
        v-if="!isCollapsed && options.brandName"
        class="sidebar-header__brand"
      >
        <div
          v-if="options.logoUrl"
          class="sidebar-header__logo"
        >
          <img
            :alt="options.brandName"
            :src="options.logoUrl"
          >
        </div>
        <span
          v-else-if="brandInitial"
          aria-hidden="true"
          class="sidebar-header__mark"
        >{{ brandInitial }}</span>
        <span class="sidebar-header__name">{{ options.brandName }}</span>
      </div>
    </Transition>

    <!-- Controls -->
    <div class="sidebar-header__controls">
      <slot name="end" />
      <button
        v-if="!isForcedCollapsed"
        :aria-label="isCollapsed ? options.labels().expand : options.labels().collapse"
        class="sidebar-header__toggle"
        type="button"
        @click="toggleCollapse"
      >
        <VIcon
          :icon="isCollapsed ? 'lucide:panel-left-open' : 'lucide:panel-left-close'"
          :size="15"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar-label-enter-active {
  transition: opacity 200ms ease;
}

.sidebar-label-enter-from {
  opacity: 0;
}

.sidebar-label-enter-to {
  opacity: 1;
}

.sidebar-label-leave-active {
  transition: opacity 150ms ease;
}

.sidebar-label-leave-from {
  opacity: 1;
}

.sidebar-label-leave-to {
  opacity: 0;
}
</style>
