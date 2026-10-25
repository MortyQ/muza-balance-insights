<!-- copied from muzakit/libs/ui/src (2026-10-22); changes: ui/README.md -->
<script lang="ts" setup>
import VIcon from "../../../base/VIcon.vue";
import { useSidebarState } from "../../composables/useSidebarState";

const { closeMobile, options } = useSidebarState();

const brandInitial = options.brandName.charAt(0).toUpperCase();
</script>

<template>
  <div class="sidebar-mobile-header">
    <div
      v-if="options.logoUrl"
      class="sidebar-mobile-header__logo"
    >
      <img
        :alt="options.brandName"
        :src="options.logoUrl"
      >
    </div>
    <span
      v-else-if="brandInitial"
      aria-hidden="true"
      class="sidebar-mobile-header__mark"
    >{{ brandInitial }}</span>

    <h1
      v-if="options.brandName"
      class="sidebar-mobile-header__name"
    >
      {{ options.brandName }}
    </h1>

    <button
      :aria-label="options.labels().closeMenu"
      class="sidebar-mobile-header__close"
      type="button"
      @click="closeMobile"
    >
      <VIcon
        :size="15"
        icon="lucide:x"
      />
    </button>
  </div>
</template>
