<script setup lang="ts">
import { MoneyStack } from '@/entities/currency-display';

const { amount, conv } = defineProps<{ amount: string; conv: ReadonlyArray<string> }>();
</script>

<template>
  <MoneyStack class="w-25" :amount="amount" :also="conv" />
</template>
