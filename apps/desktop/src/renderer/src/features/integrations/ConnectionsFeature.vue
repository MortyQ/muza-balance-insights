<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { bankOf } from '@/entities/bank';
import { useImportProgressStore } from '@/entities/import-progress';
import { colorHolders, useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { EXPAND_TRANSITION } from '@/shared/lib';
import { VButton, VInfoNotice } from '@/shared/ui';
import AddConnectionFeature from './AddConnectionFeature.vue';
import { DEFAULT_PROVIDER } from './constants.ts';
import ConnectionRow from './shared/components/ConnectionRow.vue';
import { useConnectionActions } from './shared/composables/useConnectionActions.ts';
import { formsOf, newConnectionTitle } from './utils.ts';

const participant = useParticipantStore();
const importProgress = useImportProgressStore();
const { error, setToken, setConnectionColor, remove } = useConnectionActions();
const newTitle = newConnectionTitle(bankOf(DEFAULT_PROVIDER).name);
const adding = ref(false);
const added = ref(false);

onMounted(() => void participant.refresh().catch(() => undefined));

function startAdding() {
  adding.value = true;
  added.value = false;
}

function onAdded() {
  adding.value = false;
  added.value = true;
}

async function onSetToken(connectionId: number, token: string, remember: boolean, done: (saved: boolean) => void) {
  done(await setToken(connectionId, token, remember));
}
</script>

<template>
  <SettingsSection
    title="Подключения"
    description="Банк и токен, по которому приложение читает выписку. Токен даёт только чтение: переводить деньги с ним нельзя."
    note="Подключай чужой счёт только с согласия владельца токена. «Удалить» стирает подключение, его токен и загруженные операции в этом приложении; в банке ничего не меняется."
  >
    <p v-if="!participant.hasConnections" class="text-foreground-secondary">Подключений пока нет.</p>
    <template v-for="p in participant.people" :key="p.id">
      <SettingsList v-if="p.connections.length > 0" :heading="p.label">
        <ConnectionRow
          v-for="c in p.connections"
          :key="c.id"
          :connection="c"
          :secure-storage="participant.secureStorage"
          :taken-colors="colorHolders(participant.people, 'connections', c.id)"
          :token-field="formsOf(c.provider).tokenField"
          @set-token="(token, remember, done) => onSetToken(c.id, token, remember, done)"
          @color="(color) => void setConnectionColor(c.id, color)"
          @remove="remove(c.id)"
        />
      </SettingsList>
    </template>
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
    <!-- One slot for the button and the panel: the section's gap stays the same while the panel slides. -->
    <div>
      <VButton v-if="!adding" text="Добавить подключение" icon="lucide:plus" @click="startAdding" />
      <Transition v-bind="EXPAND_TRANSITION">
        <div v-if="adding" class="grid">
          <div class="-m-1 min-h-0 overflow-hidden p-1">
            <div class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-base font-semibold">{{ newTitle }}</h3>
                <VButton variant="neutral" text="Отмена" @click="adding = false" />
              </div>
              <AddConnectionFeature :provider="DEFAULT_PROVIDER" submit-text="Добавить" autofocus @added="onAdded" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </SettingsSection>
</template>
