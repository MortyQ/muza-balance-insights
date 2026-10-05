<script setup lang="ts">
import { AppHeader } from '@/widgets/app-header';
import MasterLayout from './layouts/MasterLayout.vue';
</script>

<template>
  <!-- The title bar stays put over every layout; only the screen under it scrolls. -->
  <div class="flex h-screen flex-col">
    <AppHeader />
    <div class="min-h-0 flex-1 overflow-y-auto">
      <MasterLayout />
    </div>
  </div>
</template>
