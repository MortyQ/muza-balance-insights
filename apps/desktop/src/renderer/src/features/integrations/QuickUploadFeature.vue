<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { bankOf } from '@/entities/bank';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VIcon, VInfoNotice } from '@/shared/ui';
import ConnectionChoice from './quick-upload/components/ConnectionChoice.vue';
import { useQuickUpload } from './quick-upload/composables/useQuickUpload.ts';
import StatementUploadFeature from './statement-file/StatementUploadFeature.vue';

const { state, drop, choose, addConnection, close } = useQuickUpload();
const participant = useParticipantStore();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');

const shown = computed(() => state.value.step === 'problem' || state.value.step === 'choose' || state.value.step === 'ready');
const title = computed(() => {
  const s = state.value;
  const provider = s.step === 'choose' ? s.provider : s.step === 'ready' ? s.connection.provider : null;
  return provider ? bankOf(provider).name : null;
});

watch(shown, (open) => {
  const el = dialog.value;
  if (!el) return;
  // A modal dialog where the engine has one (Chromium); the attribute alone elsewhere (tests).
  if (open && !el.open) {
    if (typeof el.showModal === 'function') el.showModal();
    else el.setAttribute('open', '');
  }
  if (!open && el.open) {
    if (typeof el.close === 'function') el.close();
    else el.removeAttribute('open');
  }
});

// A file dragged over the window: only files, counted per enter/leave so children do not flicker the hint.
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
    <dialog
      ref="dialog"
      class="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-xl bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/40"
      :aria-label="title ?? $t('integrations.quick.button')"
      data-test="quick-upload"
      @close="close"
    >
      <div v-if="shown" class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold">{{ title ? $t('integrations.quick.title', { bank: title }) : $t('integrations.quick.button') }}</h2>
          <VButton variant="neutral" size="sm" icon="lucide:x" :text="$t('integrations.quick.close')" @click="close" />
        </div>
        <VInfoNotice v-if="state.step === 'problem'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="state.message" />
        <ConnectionChoice
          v-else-if="state.step === 'choose'"
          :provider="state.provider"
          :files="state.files"
          :tokens="state.tokens"
          :people="participant.people"
          :busy="state.busy"
          @choose="choose"
          @add="addConnection"
        />
        <StatementUploadFeature v-else-if="state.step === 'ready'" :connection="state.connection" :steps="[]" :opened="state.opened" />
      </div>
    </dialog>
  </div>
</template>
