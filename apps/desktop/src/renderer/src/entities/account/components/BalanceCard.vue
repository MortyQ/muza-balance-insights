<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { BalanceCardProps } from '../types.ts';

const { title, caption, amount, approx, others, actual, bottom, net, netText, accents, dim } = defineProps<BalanceCardProps>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="relative flex h-[214px] w-[340px] shrink-0 flex-col justify-between overflow-hidden rounded-[18px] bg-nav p-5 text-left text-white shadow-md
           transition-[transform,box-shadow] duration-450 ease-[cubic-bezier(.34,1.8,.64,1)] hover:-translate-y-[3px] hover:shadow-lg
           active:scale-[.97] active:duration-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-border-focus
           motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    :class="{ 'opacity-55': dim }"
    @click="$emit('click')"
  >
    <span
      v-for="(color, i) in accents"
      :key="i"
      class="absolute -top-7 right-[calc(-28px+var(--i)*34px)] size-24 rounded-full bg-(--accent) opacity-90"
      :style="{ '--accent': color, '--i': i }"
      aria-hidden="true"
    />
    <span class="relative flex items-center gap-2 text-base font-semibold">
      <span class="grid size-6 place-items-center rounded-[7px] bg-[#141414] text-sm font-extrabold ring-1 ring-white/15" aria-hidden="true">m</span>
      {{ title }}
    </span>
    <span class="relative flex flex-col gap-1">
      <span class="text-sm text-white/65">{{ caption }}</span>
      <span class="text-[30px] leading-none font-bold tracking-tight tabular-nums">{{ amount }}</span>
      <span v-if="approx" class="text-sm text-white/65 tabular-nums">{{ approx }}</span>
      <span v-if="others" class="text-sm text-white/65 tabular-nums">{{ others }}</span>
      <span v-if="actual" class="text-sm text-white/65 tabular-nums">{{ actual }}</span>
    </span>
    <span class="relative flex items-center justify-between text-sm text-white/70">
      <span>{{ bottom }}</span>
      <span v-if="net !== null" class="inline-flex items-center gap-1 tabular-nums">
        <VIcon :icon="net < 0 ? 'lucide:arrow-down-right' : 'lucide:arrow-up-right'" :color="net < 0 ? 'var(--card-down)' : 'var(--card-up)'" />
        <span class="font-bold text-white">{{ netText }}</span>
      </span>
    </span>
  </button>
</template>
