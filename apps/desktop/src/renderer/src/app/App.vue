<script setup lang="ts">
import { AppHeader } from '@/widgets/app-header';
</script>

<template>
  <!-- The title bar stays put; only the screen under it scrolls. -->
  <div class="flex h-screen flex-col">
    <AppHeader />
    <div class="min-h-0 flex-1 overflow-y-auto">
      <RouterView v-slot="{ Component }">
        <Transition name="swap" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>
