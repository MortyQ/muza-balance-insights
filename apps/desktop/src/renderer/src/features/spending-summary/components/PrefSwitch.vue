<script setup lang="ts">
import { useId } from 'vue';
import { VSwitch } from '@/shared/ui';

const { title, hint } = defineProps<{ title: string; hint: string }>();
const on = defineModel<boolean>({ required: true });
const id = useId();
</script>

<template>
  <div class="flex items-center gap-3 rounded-lg px-2 py-2.5">
    <label :for="id" class="flex grow cursor-pointer flex-col gap-0.5">
      <span class="font-semibold">{{ title }}</span>
      <span class="text-xs text-foreground-muted">{{ hint }}</span>
    </label>
    <VSwitch :id v-model="on" role="switch" />
  </div>
</template>
