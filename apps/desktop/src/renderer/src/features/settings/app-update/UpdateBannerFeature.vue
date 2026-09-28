<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppUpdateStore } from '@/entities/app-update';
import { VButton, VInfoNotice, VProgressBar } from '@/shared/ui';
import UpdateActions from './components/UpdateActions.vue';
import { useUpdate } from './composables/useUpdate.ts';
import { updateLine } from './utils.ts';

const store = useAppUpdateStore();
const { error, download, install } = useUpdate();
// «Later» hides the banner until the next start; the update itself stays (settings, or the next quit).
const later = ref(false);

const state = computed(() => store.view?.state ?? { phase: 'idle' as const });
const shown = computed(() => !later.value && ['available', 'downloading', 'ready', 'saved', 'error'].includes(state.value.phase));
</script>

<template>
  <div v-if="shown" class="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <VInfoNotice
        :card="false"
        :icon="state.phase === 'error' ? 'lucide:circle-alert' : 'lucide:sparkles'"
        :tone="state.phase === 'error' ? 'danger' : 'info'"
        :subtitle="updateLine(state)"
      />
      <div class="flex items-center gap-2">
        <UpdateActions :state @download="download" @install="install" />
        <VButton variant="neutral" :text="$t('settings.update.later')" @click="later = true" />
      </div>
    </div>
    <VProgressBar v-if="state.phase === 'downloading'" :percentage="state.percent" size="sm" />
    <p v-if="state.phase === 'saved'" class="text-sm text-foreground-secondary">{{ $t('settings.update.savedHelp') }}</p>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="warning" :subtitle="error" />
  </div>
</template>
