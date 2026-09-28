<script setup lang="ts">
import { onMounted } from 'vue';
import type { ColorKey } from '@contract/api.ts';
import { colorHolders, useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsSection } from '@/shared/layout';
import { VInfoNotice } from '@/shared/ui';
import PersonBlock from './components/PersonBlock.vue';
import { usePeopleActions } from './composables/usePeopleActions.ts';

const participant = useParticipantStore();
const { error, rename, restoreBankName, setPersonColor } = usePeopleActions();

// Settings open from the menu on any screen: show the current people, not what was loaded at start.
onMounted(() => void participant.refresh().catch(() => undefined));

async function onRename(id: number, label: string, done: (saved: boolean) => void) {
  done(await rename(id, label));
}

async function onRestoreBankName(id: number, done: (saved: boolean) => void) {
  done(await restoreBankName(id));
}

function onColor(id: number, color: ColorKey) {
  void setPersonColor(id, color);
}
</script>

<template>
  <SettingsSection
    :title="$t('settings.people.title')"
    :description="$t('settings.people.description')"
    :note="$t('settings.people.note')"
  >
    <p v-if="participant.people.length === 0" class="text-foreground-secondary">{{ $t('settings.people.empty') }}</p>
    <SettingsList v-else>
      <PersonBlock
        v-for="p in participant.people"
        :key="p.id"
        :person="p"
        :taken-colors="colorHolders(participant.people, p.id)"
        @rename="(label, done) => onRename(p.id, label, done)"
        @restore-bank-name="(done) => onRestoreBankName(p.id, done)"
        @color="(color) => onColor(p.id, color)"
      />
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
  </SettingsSection>
</template>
