<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { statementHint } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { shortDate, t } from '@/shared/lib';
import { VButton, VIcon, VInfoNotice, VSheet } from '@/shared/ui';
import UnknownFileCard from './quick-upload/components/UnknownFileCard.vue';
import UploadCard from './quick-upload/components/UploadCard.vue';
import { useQuickUpload } from './quick-upload/composables/useQuickUpload.ts';
import { summary } from './quick-upload/utils.ts';

const { state, drop, choose, commit, close } = useQuickUpload();
const participant = useParticipantStore();

const open = computed({
  get: () => state.value.step !== 'idle',
  set: (v) => {
    if (!v) close();
  },
});
const request = computed(() => (state.value.step === 'idle' ? {} : state.value.request));
const description = computed(() => {
  const r = request.value;
  const parts: string[] = [];
  if (r.from) parts.push(t('integrations.quick.from', { date: shortDate(r.from) }));
  if (r.provider) parts.push(statementHint(r.provider));
  return parts.join(' ');
});
const counts = computed(() => (state.value.step === 'review' ? summary(state.value.files, state.value.choices) : null));

// Files dragged over the window: only files, counted per enter/leave so children do not flicker the hint.
const dragging = ref(0);
const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
function onEnter(e: DragEvent): void {
  if (hasFiles(e)) dragging.value++;
}
function onLeave(e: DragEvent): void {
  if (hasFiles(e)) dragging.value = Math.max(0, dragging.value - 1);
}
// Without preventDefault the window would open the file itself.
function onOver(e: DragEvent): void {
  if (hasFiles(e)) e.preventDefault();
}
function onDrop(e: DragEvent): void {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragging.value = 0;
  void drop([...(e.dataTransfer?.files ?? [])]);
}
onMounted(() => {
  window.addEventListener('dragenter', onEnter);
  window.addEventListener('dragleave', onLeave);
  window.addEventListener('dragover', onOver);
  window.addEventListener('drop', onDrop);
});
onUnmounted(() => {
  window.removeEventListener('dragenter', onEnter);
  window.removeEventListener('dragleave', onLeave);
  window.removeEventListener('dragover', onOver);
  window.removeEventListener('drop', onDrop);
});
</script>

<template>
  <div>
    <div
      v-if="dragging > 0"
      class="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-xl border-2 border-dashed border-border-focus bg-background/80"
      data-test="drop-zone"
    >
      <p class="flex items-center gap-2 text-sm font-medium"><VIcon icon="lucide:file-up" :size="16" />{{ $t('integrations.quick.dropHint') }}</p>
    </div>
    <!-- The upload sheet (spec desktop-statement-upload): one card per account of every file, one «Import». -->
    <VSheet v-model:open="open" :title="$t('integrations.quick.title')" :description>
      <div data-test="quick-upload">
        <p v-if="state.step === 'opening'" class="text-sm text-foreground-muted">{{ $t('integrations.quick.reading') }}</p>
        <VInfoNotice v-else-if="state.step === 'problem'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="state.message" />
        <VInfoNotice v-else-if="state.step === 'done'" :card="false" icon="lucide:check-circle" tone="success" :subtitle="state.message" />
        <template v-else-if="state.step === 'review'">
          <ul class="flex flex-col">
            <template v-for="(file, i) in state.files" :key="i">
              <template v-if="file.ok">
                <UploadCard
                  v-for="(account, j) in file.accounts"
                  :key="`${i}-${j}`"
                  :provider="file.provider"
                  :account
                  :people="participant.people"
                  :choice="state.choices[i]?.[j] ?? null"
                  @choose="(id) => choose(i, j, id)"
                />
              </template>
              <UnknownFileCard v-else :index="i" :problem="file.problem" :row="file.row" />
            </template>
          </ul>
          <p v-if="state.error" class="mt-2 text-sm text-danger" role="alert">{{ state.error }}</p>
        </template>
      </div>
      <template #footer>
        <template v-if="state.step === 'review' && counts">
          <p class="mr-auto text-xs text-foreground-muted" data-test="upload-summary">
            {{ $t('integrations.quick.summary', { ready: counts.ready, added: counts.added }) }}
            <template v-if="counts.waiting > 0"> · {{ $t('integrations.quick.waiting', { count: counts.waiting }) }}</template>
          </p>
          <VButton variant="neutral" size="sm" :text="$t('integrations.quick.cancel')" @click="close" />
          <VButton
            size="sm"
            icon="lucide:file-up"
            :text="$t('integrations.quick.import')"
            :disabled="counts.ready === 0"
            :loading="state.busy"
            data-test="upload-import"
            @click="commit"
          />
        </template>
        <VButton v-else variant="neutral" size="sm" :text="$t('integrations.quick.close')" @click="close" />
      </template>
    </VSheet>
  </div>
</template>
