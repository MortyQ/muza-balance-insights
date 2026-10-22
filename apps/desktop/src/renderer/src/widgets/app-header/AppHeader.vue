<script setup lang="ts">
import { TITLE_BAR_HEIGHT } from '@contract/titlebar.ts';
</script>

<template>
  <!--
    The window has no system frame (main/window.ts): this empty strip drags it. macOS draws its traffic lights over the
    left edge; Windows and Linux draw their buttons over the right one. The app's name and logo live in the sidebar
    (spec desktop-app-shell), settings in the sidebar's footer and on CmdOrCtrl+,.
  -->
  <header :style="{ '--title-bar-h': `${TITLE_BAR_HEIGHT}px` }" class="h-(--title-bar-h) shrink-0 select-none [-webkit-app-region:drag]" />
</template>
