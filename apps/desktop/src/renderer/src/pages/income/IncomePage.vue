<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import type { DetailPeriod } from '@contract/api.ts';
import { useMonthStore } from '@/entities/period';
import { IncomeDetailFeature } from '@/features/income-detail';
import { incomeLink, periodRequest } from '@/shared/config';

const route = useRoute();
const router = useRouter();
const { month } = storeToRefs(useMonthStore());
const linked = computed(() => periodRequest(route.query));
// A day or a week from the link, else the global filter's month.
const period = computed((): DetailPeriod => linked.value ?? { kind: 'month', month: month.value });

// Picking a month in the global filter while a day or a week is open switches the screen to that month.
watch(month, () => {
  if (linked.value) void router.replace(incomeLink());
});
</script>

<template>
  <IncomeDetailFeature :period></IncomeDetailFeature>
</template>
