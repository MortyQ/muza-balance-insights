<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { importRequest, ROUTE, settingsSection, type SettingsSection } from '@/shared/config';
import { VButton } from '@/shared/ui';
import { SettingsWidget } from '@/widgets/settings';
import { useEscape } from './composables/useEscape.ts';

const route = useRoute();
const router = useRouter();
// Home; the router guard sends it on to the connect screen when there is neither a connection nor data.
const back = () => void router.replace({ name: ROUTE.home });
useEscape(back);

const section = computed(() => settingsSection(route.query.section));
const importAsk = computed(() => importRequest(route.query));
const select = (s: SettingsSection) => void router.replace({ name: ROUTE.settings, query: { section: s } });
</script>

<template>
  <main
    class="mx-auto grid max-w-[calc(13rem+3rem+40rem)] items-start gap-y-6 px-4 pt-6 pb-16 min-[45rem]:grid-cols-[13rem_minmax(0,1fr)] min-[45rem]:gap-x-12 min-[45rem]:px-8"
  >
    <header class="col-span-full flex items-center gap-2">
      <VButton variant="neutral" icon="lucide:chevron-left" :title="$t('settings.page.backTitle')" :aria-label="$t('settings.page.back')" @click="back" />
      <h1 class="text-xl font-semibold">{{ $t('settings.page.title') }}</h1>
    </header>
    <SettingsWidget :section :import-from="importAsk.from" :focus-import="importAsk.focus" @select="select" @deleted="back" />
  </main>
</template>
