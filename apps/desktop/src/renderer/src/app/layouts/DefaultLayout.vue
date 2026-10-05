<script setup lang="ts">
import { SideNav } from '@/shared/layout';
import { GlobalFilters } from '@/widgets/global-filters';
import { useNav } from './composables/useNav.ts';

const nav = useNav();
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- The data screens: the filters stay put above this layout's own scroll area (App's one never scrolls here), the
         menu on the left, the screen on the right. Switching screens swaps only the right side. -->
    <!-- The filters are as wide as the grid under them: the same side padding and max width (menu + gap + blocks). -->
    <div class="shrink-0 px-4 min-[45rem]:px-8">
      <GlobalFilters class="mx-auto max-w-[calc(13rem+3rem+52rem)]" />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-4 min-[45rem]:px-8">
      <div
        class="mx-auto grid max-w-[calc(13rem+3rem+52rem)] items-start gap-y-4 pt-6 pb-6 min-[45rem]:grid-cols-[13rem_minmax(0,1fr)] min-[45rem]:gap-x-12"
      >
        <SideNav :groups="nav.groups" :current="nav.current.value" label="home.nav.label" @select="nav.select" />
        <div class="min-w-0">
          <Transition name="swap" mode="out-in">
            <slot />
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>
