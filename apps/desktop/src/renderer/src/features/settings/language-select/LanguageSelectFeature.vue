<script setup lang="ts">
import { computed, useId } from 'vue';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { VInfoNotice, VSelect, type VSelectOption } from '@/shared/ui';
import { useLocale } from './composables/useLocale.ts';
import { LANGUAGE_OPTIONS } from './constants.ts';

const id = useId();
const { locale, error, select } = useLocale();
// Each language by its own name: it reads the same whatever the interface language is.
const options: VSelectOption[] = LANGUAGE_OPTIONS.map((o) => ({ label: o.label, value: o.value }));
const value = computed<string | number | null>({
  get: () => locale.value,
  set: (next) => {
    const option = LANGUAGE_OPTIONS.find((o) => o.value === next);
    if (option) void select(option.value);
  },
});
</script>

<template>
  <SettingsSection :title="$t('settings.language.title')" :description="$t('settings.language.description')">
    <SettingsList>
      <SettingsRow :title="$t('settings.language.language')" :hint="$t('settings.language.hint')" :label-for="id">
        <VSelect :id v-model="value" :options :placeholder="$t('settings.language.language')" :disabled="locale === null" class="w-44" />
      </SettingsRow>
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>
