<script setup lang="ts">
import type { Component } from 'vue';
import { ImportFeature } from '@/features/import-statement';
import { ConnectionsFeature } from '@/features/integrations';
import {
  AppLockSettingsFeature,
  AutoSyncSettingsFeature,
  DbEncryptionFeature,
  DeleteDataFeature,
  LanguageSelectFeature,
  NetworkInfoFeature,
  PeopleFeature,
  StorageInfoFeature,
  ThemeSwitchFeature,
  UpdateSettingsFeature,
} from '@/features/settings';
import type { SettingsSection } from '@/shared/config';
import { SideNav } from '@/shared/layout';
import AboutApp from './components/AboutApp.vue';
import { NAV_GROUPS } from './constants.ts';

const { section, importFrom = null, focusImport = false } = defineProps<{
  section: SettingsSection;
  /** From a link to the history download (importLink): its start date and whether to scroll to it. */
  importFrom?: string | null;
  focusImport?: boolean;
}>();
const emit = defineEmits<{ select: [section: SettingsSection]; deleted: [] }>();

// Composed below: «Storage and tokens» (the encryption row goes into its list) and «Connections» (the banks, then the
// history download).
const SECTIONS: Record<Exclude<SettingsSection, 'storage' | 'connections'>, Component> = {
  people: PeopleFeature,
  lock: AppLockSettingsFeature,
  network: NetworkInfoFeature,
  data: DeleteDataFeature,
  'auto-sync': AutoSyncSettingsFeature,
  updates: UpdateSettingsFeature,
  appearance: ThemeSwitchFeature,
  language: LanguageSelectFeature,
  about: AboutApp,
};
</script>

<template>
  <SideNav :groups="NAV_GROUPS" :current="section" label="settings.nav.label" @select="emit('select', $event)" />
  <div class="min-w-0 max-w-160">
    <Transition
      mode="out-in"
      enter-active-class="transition duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]"
      enter-from-class="opacity-0 translate-y-1 motion-reduce:translate-y-0"
    >
      <StorageInfoFeature v-if="section === 'storage'" key="storage">
        <DbEncryptionFeature />
      </StorageInfoFeature>
      <div v-else-if="section === 'connections'" key="connections" class="flex flex-col gap-12">
        <ConnectionsFeature />
        <ImportFeature :requested-from="importFrom" :focus="focusImport" />
      </div>
      <component :is="SECTIONS[section]" v-else :key="section" @deleted="emit('deleted')" />
    </Transition>
  </div>
</template>
