<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { NavigationSidebar, VIcon } from '@/shared/ui';
import { GlobalFilters } from '@/widgets/global-filters';
import { useAppSidebar } from './composables/useAppSidebar.ts';
import { useNav } from './composables/useNav.ts';
import { useScrollTop } from './composables/useScrollTop.ts';

const nav = useNav();
const { sidebar, footerItems } = useAppSidebar();
const title = computed(() => nav.groups.flatMap((g) => g.items).find((i) => i.id === nav.current.value)?.label ?? null);
useScrollTop(useTemplateRef<HTMLElement>('area'));
</script>

<template>
  <div class="flex h-full min-[45rem]:pr-3 min-[45rem]:pb-3">
    <!-- The data screens: the app navigation at the window's left edge on the window's background (spec
         desktop-app-shell), then a panel — rounded, on the surface colour — with the header (title and filters, it
         stays put) over this layout's own scroll area (App's one never scrolls here). Switching screens swaps only the
         screen. Below 45rem the sidebar is a drawer opened from the header and the panel fills the window. -->
    <NavigationSidebar :sidebar :footer-items class="h-full shrink-0" />
    <div
      class="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface min-[45rem]:rounded-2xl min-[45rem]:border min-[45rem]:border-border-subtle min-[45rem]:shadow-xs"
      data-test="layout-panel"
    >
      <div class="flex shrink-0 items-center gap-3 border-b border-border-subtle px-4 min-[45rem]:px-8">
        <button
          type="button"
          :aria-label="$t('home.nav.openMenu')"
          class="grid size-8 shrink-0 place-items-center rounded-md text-foreground-secondary hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-focus min-[45rem]:hidden"
          @click="sidebar.toggleMobile"
        >
          <VIcon icon="lucide:menu" :size="16" />
        </button>
        <h1 v-if="title" class="shrink-0 text-lg font-semibold" data-test="screen-title">{{ $t(title) }}</h1>
        <GlobalFilters class="min-w-0 flex-1" />
      </div>
      <div ref="area" class="min-h-0 flex-1 overflow-y-auto px-4 min-[45rem]:px-8" data-test="layout-scroll">
        <div class="mx-auto w-full max-w-[100rem] pt-6 pb-6">
          <Transition name="swap" mode="out-in">
            <slot />
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>
