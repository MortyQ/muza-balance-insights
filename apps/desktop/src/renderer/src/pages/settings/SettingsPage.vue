<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { connectionsTab, type ConnectionsTab, importRequest, ROUTE, settingsSection, type SettingsSection } from '@/shared/config';
import { VButton } from '@/shared/ui';
import { SettingsWidget } from '@/widgets/settings';
import { useEscape } from './composables/useEscape.ts';

const route = useRoute();
const router = useRouter();
// Home; the router guard sends it on to the connect screen when there is neither a connection nor data.
const back = () => void router.replace({ name: ROUTE.home });
useEscape(back);

const section = computed(() => settingsSection(route.query.section));
const tab = computed(() => connectionsTab(route.query.tab));
const importAsk = computed(() => importRequest(route.query));
const select = (s: SettingsSection) => void router.replace({ name: ROUTE.settings, query: { section: s } });
// A tab picked by hand drops what a link asked of the download (focus, date).
const selectTab = (t: ConnectionsTab) => void router.replace({ name: ROUTE.settings, query: { section: 'connections', tab: t } });
</script>

<template>
  <main
    class="mx-auto grid max-w-[calc(13rem+3rem+40rem)] items-start gap-y-6 px-4 pt-6 pb-16 min-[45rem]:grid-cols-[13rem_minmax(0,1fr)] min-[45rem]:gap-x-12 min-[45rem]:px-8"
  >
    <header class="col-span-full flex items-center gap-2">
      <VButton variant="neutral" icon="lucide:chevron-left" :title="$t('settings.page.backTitle')" :aria-label="$t('settings.page.back')" @click="back" />
      <h1 class="text-xl font-semibold">{{ $t('settings.page.title') }}</h1>
    </header>
    <SettingsWidget
      :section
      :tab
      :import-from="importAsk.from"
      :focus-import="importAsk.focus"
      @select="select"
      @select-tab="selectTab"
      @deleted="back"
    />
  </main>
</template>
