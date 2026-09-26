<script setup lang="ts">
import { computed } from 'vue';
import { useAsyncData } from '@/shared/lib';
import { VIcon, VInfoNotice } from '@/shared/ui';
import { useTrustedServicesRequest } from './api/useTrustedServicesRequest.ts';
import { SERVICE_TEXT } from './constants.ts';

const request = useTrustedServicesRequest();
const { state } = useAsyncData(() => request.list(), []);
const services = computed(() => (state.value.data ?? []).map((s) => ({ ...s, ...SERVICE_TEXT[s.id] })));
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h2 class="text-xl font-semibold">Сеть</h2>
      <p class="max-w-[62ch] text-sm text-foreground-muted">Приложение обращается только к этим сервисам.</p>
    </div>
    <VInfoNotice
      v-if="state.status === 'error'"
      :card="false"
      icon="lucide:circle-alert"
      tone="danger"
      subtitle="Не удалось получить список сервисов."
    />
    <div
      v-if="services.length > 0"
      class="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm [&>*+*]:border-t [&>*+*]:border-border-subtle"
    >
      <div v-for="s in services" :key="s.id" class="flex flex-col gap-2 px-4 py-3">
        <div class="flex flex-col gap-0.5">
          <span class="font-semibold">{{ s.title }}</span>
          <span class="text-sm text-foreground-muted">{{ s.purpose }}</span>
        </div>
        <div class="flex flex-wrap gap-1">
          <span v-for="h in s.hosts" :key="h" class="rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-sm text-foreground-secondary">
            {{ h }}
          </span>
        </div>
      </div>
    </div>
    <p class="flex max-w-[62ch] items-start gap-2 text-sm text-foreground-muted">
      <VIcon icon="lucide:shield-check" :size="14" class="mt-px" />
      Другие адреса заблокированы в коде, а не настройкой. Только https и порт по умолчанию; перенаправление на другой адрес
      отклоняется.
    </p>
  </section>
</template>
