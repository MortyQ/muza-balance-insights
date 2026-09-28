<script setup lang="ts">
import { computed } from 'vue';
import { AUTHOR, LICENSE, REPO } from '@contract/about.ts';
import { useAppUpdateStore } from '@/entities/app-update';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { VIcon } from '@/shared/ui';

const update = useAppUpdateStore();
const version = computed(() => update.view?.currentVersion ?? null);
</script>

<template>
  <SettingsSection :title="$t('settings.about.title')">
    <SettingsList>
      <div class="flex items-center gap-3 px-4 py-3">
        <span class="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-md" aria-hidden="true">
          <VIcon icon="lucide:wallet" :size="24" />
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-semibold">Balance Insights</span>
          <span class="text-sm text-foreground-muted">
            <template v-if="version">{{ $t('settings.about.version', { version }) }}</template>{{ $t('common.disclaimer') }}
          </span>
        </div>
      </div>
      <SettingsRow :title="$t('settings.about.license')"><span>{{ LICENSE }}</span></SettingsRow>
      <SettingsRow :title="$t('settings.about.source')"><span class="font-mono text-sm">{{ REPO }}</span></SettingsRow>
      <SettingsRow :title="$t('settings.about.author')"><span>{{ AUTHOR }}</span></SettingsRow>
    </SettingsList>
  </SettingsSection>
</template>
