<script setup lang="ts">
import { computed, useId } from 'vue';
import { useAppUpdateStore } from '@/entities/app-update';
import { VButton, VIcon, VInfoNotice, VProgressBar, VSwitch } from '@/shared/ui';
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
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h2 class="text-xl font-semibold">Обновления</h2>
      <p class="max-w-[62ch] text-sm text-foreground-muted">Новые версии приходят с GitHub и ставятся, только если подписаны автором.</p>
    </div>
    <div v-if="view" class="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm [&>*+*]:border-t [&>*+*]:border-border-subtle">
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
      <div class="flex min-h-13 items-center justify-between gap-4 px-4 py-3">
        <label :for="switchId" class="flex min-w-0 cursor-pointer flex-col gap-0.5">
          <span class="font-semibold">Проверять автоматически</span>
          <span class="text-sm text-foreground-muted">
            {{ view.supported ? 'Через 10 секунд после запуска и раз в 6 часов.' : 'В сборке для разработки обновления не проверяются.' }}
          </span>
        </label>
        <VSwitch :id="switchId" v-model="checksEnabled" :disabled="!view.supported" role="switch" />
      </div>
    </div>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    <p class="flex max-w-[62ch] items-start gap-2 text-sm text-foreground-muted">
      <VIcon icon="lucide:shield-check" :size="14" class="mt-px" />
      Перед установкой файл сверяется с подписанным описанием версии: размер и контрольная сумма. Откат на старую версию невозможен.
    </p>
  </section>
</template>
