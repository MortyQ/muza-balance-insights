<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { osStoreName } from '@/shared/lib';
import { tokensStorage } from './utils.ts';

const participant = useParticipantStore();
const store = osStoreName(navigator.userAgent);

onMounted(() => void participant.refresh().catch(() => undefined));

// The store assumes secure storage until main answers; this screen must not claim it before that.
const tokens = computed(() => tokensStorage(participant.view?.secureStorage ?? null, store));
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h2 class="text-xl font-semibold">Хранение и токены</h2>
      <p class="max-w-[62ch] text-sm text-foreground-muted">Где лежат выписка и токены и кто может их прочитать.</p>
    </div>
    <div class="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm [&>*+*]:border-t [&>*+*]:border-border-subtle">
      <div class="flex min-h-13 flex-col justify-center gap-0.5 px-4 py-3">
        <span class="font-semibold">Операции</span>
        <span class="text-sm text-foreground-muted">База в папке приложения на этом компьютере. В облако не копируется.</span>
      </div>
      <div v-if="tokens" class="flex min-h-13 flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-semibold">Токены</span>
          <span class="text-sm text-foreground-muted">{{ tokens.hint }}</span>
        </div>
        <span
          class="inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current"
          :class="tokens.ok ? 'bg-success-subtle text-success' : 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning'"
        >
          {{ tokens.badge }}
        </span>
      </div>
      <div class="flex min-h-13 flex-col justify-center gap-0.5 px-4 py-3">
        <span class="font-semibold">Импорт при запуске</span>
        <span class="text-sm text-foreground-muted">
          Незавершённый импорт продолжается сам, если токен сохранён. Иначе приложение попросит его ввести.
        </span>
      </div>
    </div>
  </section>
</template>
