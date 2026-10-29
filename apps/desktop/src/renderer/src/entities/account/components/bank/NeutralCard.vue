<script setup lang="ts">
import type { BankCardProps } from '../../types.ts';
import CardShell from './CardShell.vue';

// A bank without a look of its own: the card's body on the app's dark navy, no wordmark.
const { variant: _variant, ...figures } = defineProps<BankCardProps>();
defineEmits<{ click: [] }>();
</script>

<template>
  <CardShell v-bind="figures" class="bg-nav" @click="$emit('click')" />
</template>
