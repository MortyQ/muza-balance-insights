<script setup lang="ts">
import { computed } from 'vue';
import { AUTHOR, DISCLAIMER, LICENSE, REPO } from '@contract/about.ts';
import { useAppUpdateStore } from '@/entities/app-update';
import { SettingsList, SettingsRow, SettingsSection } from '@/features/settings';
import { VIcon } from '@/shared/ui';

const update = useAppUpdateStore();
const version = computed(() => update.view?.currentVersion ?? null);
</script>

<template>
  <SettingsSection title="О программе">
    <SettingsList>
      <div class="flex items-center gap-3 px-4 py-3">
        <span class="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-md" aria-hidden="true">
          <VIcon icon="lucide:wallet" :size="24" />
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-semibold">Balance Insights</span>
          <span class="text-sm text-foreground-muted">
            <template v-if="version">Версия {{ version }} · </template>{{ DISCLAIMER }}
          </span>
        </div>
      </div>
      <SettingsRow title="Лицензия"><span>{{ LICENSE }}</span></SettingsRow>
      <SettingsRow title="Исходный код"><span class="font-mono text-sm">{{ REPO }}</span></SettingsRow>
      <SettingsRow title="Автор"><span>{{ AUTHOR }}</span></SettingsRow>
    </SettingsList>
  </SettingsSection>
</template>
