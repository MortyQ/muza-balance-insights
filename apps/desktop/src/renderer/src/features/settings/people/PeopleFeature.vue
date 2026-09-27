<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { VButton, VCard, VInfoNotice } from '@/shared/ui';
import AddConnectionForm from './components/AddConnectionForm.vue';
import PersonBlock from './components/PersonBlock.vue';
import { usePeopleActions } from './composables/usePeopleActions.ts';

const participant = useParticipantStore();
const importProgress = useImportProgressStore();
const { error, rename, setToken, remove } = usePeopleActions();
const adding = ref(false);
const added = ref(false);

// Settings open from the menu on any screen: show the current people, not what was loaded at start.
onMounted(() => void participant.refresh().catch(() => undefined));

function startAdding() {
  adding.value = true;
  added.value = false;
}

function onAdded() {
  adding.value = false;
  added.value = true;
}

async function onRename(id: number, label: string, done: (saved: boolean) => void) {
  done(await rename(id, label));
}

async function onSetToken(connectionId: number, token: string, remember: boolean, done: (saved: boolean) => void) {
  done(await setToken(connectionId, token, remember));
}
</script>

<template>
  <VCard title="Люди и подключения" padding="md">
    <div class="flex flex-col gap-5">
      <p v-if="!participant.hasConnections" class="text-foreground-secondary">Подключений пока нет.</p>
      <PersonBlock
        v-for="p in participant.people"
        :key="p.id"
        :person="p"
        :secure-storage="participant.secureStorage"
        @rename="(label, done) => onRename(p.id, label, done)"
        @set-token="onSetToken"
        @remove="remove"
      />
      <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
      <VInfoNotice
        v-if="added"
        :card="false"
        icon="lucide:check-circle"
        tone="success"
        :subtitle="
          importProgress.running
            ? 'Подключение добавлено. Оно загрузится со следующим импортом.'
            : 'Подключение добавлено. Нажми «Загрузить» на главном экране — загрузятся все подключения.'
        "
      />
      <div v-if="!adding">
        <VButton text="Добавить подключение" @click="startAdding" />
      </div>
      <div v-else class="flex flex-col gap-3 rounded-lg border border-border-subtle p-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-base font-semibold">Новое подключение Monobank</h3>
          <VButton variant="neutral" text="Отмена" @click="adding = false" />
        </div>
        <AddConnectionForm submit-text="Добавить" autofocus @added="onAdded" />
      </div>
      <p class="text-sm text-foreground-muted">
        «Удалить» стирает подключение, его токен и загруженные операции его счетов в этом приложении. В банке ничего не меняется.
      </p>
    </div>
  </VCard>
</template>
