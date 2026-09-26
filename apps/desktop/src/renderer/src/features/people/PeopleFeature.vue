<script setup lang="ts">
import { onMounted } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { VIcon, VInfoNotice } from '@/shared/ui';
import PersonBlock from './components/PersonBlock.vue';
import { usePeopleActions } from './composables/usePeopleActions.ts';

const participant = useParticipantStore();
const { error, rename } = usePeopleActions();

// Settings open from the menu on any screen: show the current people, not what was loaded at start.
onMounted(() => void participant.refresh().catch(() => undefined));

async function onRename(id: number, label: string, done: (saved: boolean) => void) {
  done(await rename(id, label));
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h2 class="text-xl font-semibold">Люди</h2>
      <p class="max-w-[62ch] text-sm text-foreground-muted">
        Чьи счета загружаются в приложение. Имя человека хранится только на этом компьютере и никуда не отправляется.
      </p>
    </div>
    <p v-if="participant.people.length === 0" class="text-foreground-secondary">Людей пока нет.</p>
    <div v-else class="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm [&>*+*]:border-t [&>*+*]:border-border-subtle">
      <PersonBlock v-for="p in participant.people" :key="p.id" :person="p" @rename="(label, done) => onRename(p.id, label, done)" />
    </div>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    <p class="flex max-w-[62ch] items-start gap-2 text-sm text-foreground-muted">
      <VIcon icon="lucide:info" :size="14" class="mt-px" />
      Человек добавляется вместе с подключением — в разделе «Подключения». Когда подключений у человека не остаётся, он удаляется
      сам.
    </p>
  </section>
</template>
