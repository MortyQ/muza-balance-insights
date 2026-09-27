<script setup lang="ts">
import { computed } from 'vue';
import type { ThemePref } from '@contract/theme.ts';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { VInfoNotice, VSegmentedControl } from '@/shared/ui';
import { useTheme } from './composables/useTheme.ts';
import { THEME_OPTIONS } from './constants.ts';

const { theme, error, select } = useTheme();
const value = computed<ThemePref>({
  get: () => theme.value ?? 'system',
  set: (t) => void select(t),
});
</script>

<template>
  <SettingsSection title="Оформление" description="Тема окна, меню и системных диалогов.">
    <SettingsList>
      <SettingsRow title="Тема" hint="«Как в системе» меняется вместе с настройкой системы.">
        <VSegmentedControl v-model="value" :options="THEME_OPTIONS" :disabled="theme === null" />
      </SettingsRow>
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>
