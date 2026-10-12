<script setup lang="ts">
import { AllowanceFeature } from '@/features/daily-allowance';
</script>

<template>
  <main class="flex min-h-full flex-col gap-4">
    <!-- Planners and their settings; «Available per day» for now. -->
    <AllowanceFeature />
  </main>
</template>
