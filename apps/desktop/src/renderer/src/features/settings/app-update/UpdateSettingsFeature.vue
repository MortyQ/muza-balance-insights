<script setup lang="ts">
import { computed, useId } from 'vue';
import { useAppUpdateStore } from '@/entities/app-update';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { VButton, VInfoNotice, VProgressBar, VSwitch } from '@/shared/ui';
import UpdateActions from './components/UpdateActions.vue';
import { useUpdate } from './composables/useUpdate.ts';
import { updateLine } from './utils.ts';

const store = useAppUpdateStore();
const { error, check, download, install, setChecks } = useUpdate();
const switchId = useId();

const view = computed(() => store.view);
const line = computed(() => (view.value ? updateLine(view.value.state) : ''));
const checking = computed(() => store.phase === 'checking');
const checksEnabled = computed({
  get: () => view.value?.checksEnabled ?? true,
  set: (enabled: boolean) => void setChecks(enabled),
});
</script>

<template>
  <SettingsSection
    title="Обновления"
    description="Новые версии приходят с GitHub и ставятся, только если подписаны автором."
    note="Перед установкой файл сверяется с подписанным описанием версии: размер и контрольная сумма. Откат на старую версию невозможен."
    note-icon="lucide:shield-check"
  >
    <SettingsList v-if="view">
      <div class="flex flex-col gap-3 px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="font-semibold">Версия {{ view.currentVersion }}</span>
            <span v-if="line" class="text-sm" :class="view.state.phase === 'error' ? 'text-danger' : 'text-foreground-muted'">{{ line }}</span>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <UpdateActions :state="view.state" @download="download" @install="install" />
            <VButton
              variant="neutral"
              text="Проверить сейчас"
              icon="lucide:refresh-cw"
              :loading="checking"
              :disabled="!view.supported || ['downloading', 'ready', 'saved'].includes(view.state.phase)"
              @click="check"
            />
          </div>
        </div>
        <VProgressBar v-if="view.state.phase === 'downloading'" :percentage="view.state.percent" size="sm" />
      </div>
      <SettingsRow
        title="Проверять автоматически"
        :hint="view.supported ? 'Через 10 секунд после запуска и раз в 6 часов.' : 'В сборке для разработки обновления не проверяются.'"
        :label-for="switchId"
      >
        <VSwitch :id="switchId" v-model="checksEnabled" :disabled="!view.supported" role="switch" />
      </SettingsRow>
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>
