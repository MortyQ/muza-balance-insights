<script setup lang="ts">
import { onMounted } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { VInfoNotice } from '@/shared/ui';
import PersonBlock from './components/PersonBlock.vue';
import { usePeopleActions } from './composables/usePeopleActions.ts';
import SettingsList from '../shared/components/SettingsList.vue';
import SettingsSection from '../shared/components/SettingsSection.vue';

const participant = useParticipantStore();
const { error, rename } = usePeopleActions();

// Settings open from the menu on any screen: show the current people, not what was loaded at start.
onMounted(() => void participant.refresh().catch(() => undefined));

async function onRename(id: number, label: string, done: (saved: boolean) => void) {
  done(await rename(id, label));
}
</script>

<template>
  <SettingsSection
    title="Люди"
    description="Чьи счета загружаются в приложение. Имя человека хранится только на этом компьютере и никуда не отправляется."
    note="Человек добавляется вместе с подключением — в разделе «Подключения». Когда подключений у человека не остаётся, он удаляется сам."
  >
    <p v-if="participant.people.length === 0" class="text-foreground-secondary">Людей пока нет.</p>
    <SettingsList v-else>
      <PersonBlock v-for="p in participant.people" :key="p.id" :person="p" @rename="(label, done) => onRename(p.id, label, done)" />
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>
