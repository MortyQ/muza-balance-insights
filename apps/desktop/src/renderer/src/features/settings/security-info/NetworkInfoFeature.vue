<script setup lang="ts">
import { computed } from 'vue';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { useAsyncData } from '@/shared/lib';
import { VInfoNotice } from '@/shared/ui';
import { useTrustedServicesRequest } from './api/useTrustedServicesRequest.ts';
import { SERVICE_TEXT } from './constants.ts';

const request = useTrustedServicesRequest();
const { state } = useAsyncData(() => request.list(), []);
const services = computed(() => (state.value.data ?? []).map((s) => ({ ...s, ...SERVICE_TEXT[s.id] })));
</script>

<template>
  <SettingsSection
    title="Сеть"
    description="Приложение обращается только к этим сервисам."
    note="Другие адреса заблокированы в коде, а не настройкой. Только https и порт по умолчанию; перенаправление на другой адрес отклоняется."
    note-icon="lucide:shield-check"
  >
    <VInfoNotice
      v-if="state.status === 'error'"
      :card="false"
      icon="lucide:circle-alert"
      tone="danger"
      subtitle="Не удалось получить список сервисов."
    />
    <SettingsList v-if="services.length > 0">
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
    </SettingsList>
  </SettingsSection>
</template>
