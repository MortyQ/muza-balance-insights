<script setup lang="ts">
import { computed } from 'vue';
import type { BankLook } from '../types.ts';
import { bankLogo } from '../utils.ts';

const { bank, size = 'md' } = defineProps<{ bank: Readonly<BankLook & { id: string }>; size?: 'xs' | 'sm' | 'md' | 'lg' }>();

const logo = computed<string | null>(() => bankLogo(bank.id));
const sizeClass = computed(() => ({ xs: 'size-4 rounded text-[0.625rem]', sm: 'size-7 rounded-md text-sm', md: 'size-10 rounded-lg text-lg', lg: 'size-12 rounded-xl text-xl' })[size]);
</script>

<template>
  <img v-if="logo" :src="logo" alt="" :class="sizeClass" class="shrink-0 object-contain" />
  <span
    v-else
    aria-hidden="true"
    :class="[sizeClass, bank.monogramClass]"
    class="flex shrink-0 items-center justify-center font-semibold leading-none select-none"
  >
    {{ bank.monogram }}
  </span>
</template>
