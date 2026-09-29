<script setup lang="ts">
import type { Component } from 'vue';
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

const { section } = defineProps<{ section: SettingsSection }>();
const emit = defineEmits<{ select: [section: SettingsSection]; deleted: [] }>();

// «Storage and tokens» is composed below: the encryption row goes into its list.
const SECTIONS: Record<Exclude<SettingsSection, 'storage'>, Component> = {
  people: PeopleFeature,
  connections: ConnectionsFeature,
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
      <component :is="SECTIONS[section]" v-else :key="section" @deleted="emit('deleted')" />
    </Transition>
  </div>
</template>
