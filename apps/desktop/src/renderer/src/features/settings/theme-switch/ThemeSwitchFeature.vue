<script setup lang="ts">
import { computed } from 'vue';
import type { ThemePref } from '@contract/theme.ts';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { VInfoNotice, VSegmentedControl } from '@/shared/ui';
import { t } from '@/shared/lib';
import { useTheme } from './composables/useTheme.ts';
import { THEME_OPTIONS } from './constants.ts';

const { theme, error, select } = useTheme();
const value = computed<ThemePref>({
  get: () => theme.value ?? 'system',
  set: (next) => void select(next),
});
const options = computed(() => THEME_OPTIONS.map((o) => ({ ...o, label: t(o.label) })));
</script>

<template>
  <SettingsSection :title="$t('settings.theme.title')" :description="$t('settings.theme.description')">
    <SettingsList>
      <SettingsRow :title="$t('settings.theme.theme')" :hint="$t('settings.theme.hint')">
        <VSegmentedControl v-model="value" :options :disabled="theme === null" />
      </SettingsRow>
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>
