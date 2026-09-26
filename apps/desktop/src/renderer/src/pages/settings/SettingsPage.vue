<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UpdateSettingsFeature } from '@/features/app-update';
import { DeleteDataFeature } from '@/features/delete-data';
import { ConnectionsFeature, PeopleFeature } from '@/features/people';
import { NetworkInfoFeature, StorageInfoFeature } from '@/features/security-info';
import { ROUTE, settingsSection, type SettingsSection } from '@/shared/config';
import { VButton } from '@/shared/ui';
import { AboutApp } from '@/widgets/about-app';
import { SettingsNav } from '@/widgets/settings-nav';
import { useEscape } from './composables/useEscape.ts';

const route = useRoute();
const router = useRouter();
// Home; the router guard sends it on to the connect screen when there is neither a connection nor data.
const back = () => void router.replace({ name: ROUTE.home });
useEscape(back);

const section = computed(() => settingsSection(route.query.section));
const select = (s: SettingsSection) => void router.replace({ name: ROUTE.settings, query: { section: s } });

const SECTIONS: Record<SettingsSection, Component> = {
  people: PeopleFeature,
  connections: ConnectionsFeature,
  storage: StorageInfoFeature,
  network: NetworkInfoFeature,
  data: DeleteDataFeature,
  updates: UpdateSettingsFeature,
  about: AboutApp,
};
</script>

<template>
  <main
    class="mx-auto grid max-w-[calc(13rem+3rem+40rem)] items-start gap-y-6 px-4 pt-6 pb-16 min-[45rem]:grid-cols-[13rem_minmax(0,1fr)] min-[45rem]:gap-x-12 min-[45rem]:px-8"
  >
    <header class="col-span-full flex items-center gap-2">
      <VButton variant="neutral" icon="lucide:chevron-left" title="Назад (Esc)" aria-label="Назад" @click="back" />
      <h1 class="text-xl font-semibold">Настройки</h1>
    </header>
    <SettingsNav :current="section" @select="select" />
    <div class="min-w-0 max-w-160">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]"
        enter-from-class="opacity-0 translate-y-1 motion-reduce:translate-y-0"
      >
        <component :is="SECTIONS[section]" :key="section" @deleted="back" />
      </Transition>
    </div>
  </main>
</template>
