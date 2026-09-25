<script setup lang="ts">
import { computed } from 'vue';
import { useAppUpdateStore } from '@/entities/app-update';
import { VButton, VCard, VInfoNotice, VProgressBar } from '@/shared/ui';
import UpdateActions from './components/UpdateActions.vue';
import { useUpdate } from './composables/useUpdate.ts';
import { updateLine } from './utils.ts';

const store = useAppUpdateStore();
const { error, check, download, install, setChecks } = useUpdate();

const view = computed(() => store.view);
const line = computed(() => (view.value ? updateLine(view.value.state) : ''));
const checking = computed(() => store.phase === 'checking');
const checksEnabled = computed({
  get: () => view.value?.checksEnabled ?? true,
  set: (enabled: boolean) => void setChecks(enabled),
});
</script>

<template>
  <VCard title="Обновления" padding="md">
    <div v-if="view" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-foreground-secondary">Версия {{ view.currentVersion }}</span>
        <VButton
          variant="neutral"
          text="Проверить сейчас"
          icon="lucide:refresh-cw"
          :loading="checking"
          :disabled="!view.supported || ['downloading', 'ready', 'saved'].includes(view.state.phase)"
          @click="check"
        />
        <UpdateActions :state="view.state" @download="download" @install="install" />
      </div>
      <VProgressBar v-if="view.state.phase === 'downloading'" :percentage="view.state.percent" size="sm" />
      <p v-if="line" class="text-sm" :class="view.state.phase === 'error' ? 'text-danger' : 'text-foreground-secondary'">{{ line }}</p>
      <label class="flex items-center gap-2">
        <input v-model="checksEnabled" class="accent-primary" type="checkbox" :disabled="!view.supported" />
        Проверять обновления автоматически
      </label>
      <p class="text-sm text-foreground-muted">
        <template v-if="view.supported">
          Раз в несколько часов приложение запрашивает у GitHub, вышла ли новая версия. Обновление ставится, только если оно подписано
          автором и файл совпал с подписанным описанием.
        </template>
        <template v-else>В сборке для разработки обновления не проверяются.</template>
      </p>
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    </div>
  </VCard>
</template>
