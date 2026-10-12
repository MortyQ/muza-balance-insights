<script setup lang="ts">
import { type Component, computed } from 'vue';
import { BankRefreshFeature } from '@/features/bank-refresh';
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
import { CONNECTION_TABS, type ConnectionsTab, type SettingsSection } from '@/shared/config';
import { SideNav } from '@/shared/layout';
import { t } from '@/shared/lib';
import { type SegmentOption, VSegmentedControl } from '@/shared/ui';
import AboutApp from './components/AboutApp.vue';
import { CONNECTION_TAB_LABELS, NAV_GROUPS } from './constants.ts';

const { section, tab = 'banks', importFrom = null, focusImport = false } = defineProps<{
  section: SettingsSection;
  /** The open tab of «Connections». */
  tab?: ConnectionsTab;
  /** From a link to the history download (importLink): its start date and whether to scroll to it. */
  importFrom?: string | null;
  focusImport?: boolean;
}>();
const emit = defineEmits<{ select: [section: SettingsSection]; selectTab: [tab: ConnectionsTab]; deleted: [] }>();

const tabOptions = computed<SegmentOption<ConnectionsTab>[]>(() => CONNECTION_TABS.map((value) => ({ value, label: t(CONNECTION_TAB_LABELS[value]) })));

// Composed below: «Storage and tokens» (the encryption row goes into its list) and «Connections» — three tabs, one
// shown at a time: the banks with «Refresh» of the bank chosen there, auto-sync, the history download.
const SECTIONS: Record<Exclude<SettingsSection, 'storage' | 'connections'>, Component> = {
  people: PeopleFeature,
  lock: AppLockSettingsFeature,
  network: NetworkInfoFeature,
  data: DeleteDataFeature,
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
      <div v-else-if="section === 'connections'" key="connections" class="flex flex-col gap-6">
        <VSegmentedControl
          class="self-start"
          role="group"
          :aria-label="$t('settings.connections.tabsLabel')"
          :model-value="tab"
          :options="tabOptions"
          @update:model-value="emit('selectTab', $event)"
        />
        <Transition
          mode="out-in"
          enter-active-class="transition duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]"
          enter-from-class="opacity-0 translate-y-1 motion-reduce:translate-y-0"
        >
          <ConnectionsFeature v-if="tab === 'banks'" key="banks">
            <template #toolbar="{ provider }">
              <BankRefreshFeature :provider />
            </template>
          </ConnectionsFeature>
          <AutoSyncSettingsFeature v-else-if="tab === 'auto-sync'" key="auto-sync" />
          <ImportFeature v-else key="history" :requested-from="importFrom" :focus="focusImport" />
        </Transition>
      </div>
      <component :is="SECTIONS[section]" v-else :key="section" @deleted="emit('deleted')" />
    </Transition>
  </div>
</template>
