<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TITLE_BAR_HEIGHT } from '@contract/titlebar.ts';
import { ROUTE } from '@/shared/config';
import { VIcon } from '@/shared/ui';
import { appHeaderLayout } from './utils.ts';

const route = useRoute();
const router = useRouter();
const mac = appHeaderLayout(navigator.userAgent) === 'mac';
const inSettings = computed(() => route.name === ROUTE.settings);

function openSettings() {
  if (!inSettings.value) void router.push({ name: ROUTE.settings });
}
</script>

<template>
  <!--
    The window has no system frame (main/window.ts): this strip drags it. macOS draws its traffic lights over the left
    edge; Windows and Linux draw their buttons over the right one, inside the window-controls-overlay area
    (fallback: three 46px Windows buttons).
  -->
  <header
    :style="{ '--title-bar-h': `${TITLE_BAR_HEIGHT}px` }"
    class="grid h-(--title-bar-h) shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center select-none [-webkit-app-region:drag]"
    :class="mac ? 'pr-2 pl-20' : 'pr-[calc(100vw_-_env(titlebar-area-x,0px)_-_env(titlebar-area-width,calc(100vw_-_138px))_+_4px)] pl-3'"
  >
    <div class="flex min-w-0 items-center gap-2">
      <template v-if="!mac">
        <svg class="size-4 shrink-0" viewBox="100 100 824 824" aria-hidden="true">
          <rect x="100" y="100" width="824" height="824" rx="185" fill="#1F1548" />
          <path d="M214 390 C342 390 342 560 470 560" fill="none" stroke="#5EEAD4" stroke-width="60" stroke-linecap="round" />
          <path d="M214 730 C342 730 342 560 470 560" fill="none" stroke="#8B6CFF" stroke-width="60" stroke-linecap="round" />
          <path d="M214 560 H470" stroke="#F4FFFD" stroke-width="60" stroke-linecap="round" />
          <polyline
            points="470,560 540,560 590,400 650,640 706,460 752,540 800,540"
            fill="none"
            stroke="#F4FFFD"
            stroke-width="60"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="truncate text-xs text-foreground-secondary">Balance Insights</span>
      </template>
    </div>
    <span v-if="mac" class="text-sm font-semibold text-foreground-secondary">Balance Insights</span>
    <span v-else />
    <div class="flex justify-end">
      <button
        type="button"
        aria-label="Настройки"
        :title="mac ? 'Настройки (⌘,)' : 'Настройки (Ctrl+,)'"
        :aria-current="inSettings ? 'page' : undefined"
        class="grid size-7 place-items-center rounded-md text-foreground-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-focus aria-[current=page]:text-primary [-webkit-app-region:no-drag]"
        @click="openSettings"
      >
        <VIcon icon="lucide:settings" :size="16" />
      </button>
    </div>
  </header>
</template>
