<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { osStoreName } from '@/shared/lib';
import { tokensStorage } from './utils.ts';

const participant = useParticipantStore();
const store = osStoreName(navigator.userAgent);

onMounted(() => void participant.refresh().catch(() => undefined));

// The store assumes secure storage until main answers; this screen must not claim it before that.
const tokens = computed(() => tokensStorage(participant.view?.secureStorage ?? null, store));
</script>

<template>
  <SettingsSection title="Хранение и токены" description="Где лежат выписка и токены и кто может их прочитать.">
    <SettingsList>
      <SettingsRow title="Операции" hint="База в папке приложения на этом компьютере. В облако не копируется." />
      <!-- The database's encryption (db-encryption), composed in by the settings widget. -->
      <slot />
      <SettingsRow v-if="tokens" title="Токены" :hint="tokens.hint">
        <span
          class="inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current"
          :class="tokens.ok ? 'bg-success-subtle text-success' : 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning'"
        >
          {{ tokens.badge }}
        </span>
      </SettingsRow>
      <SettingsRow
        title="Импорт при запуске"
        hint="Незавершённый импорт продолжается сам, если токен сохранён. Иначе приложение попросит его ввести."
      />
    </SettingsList>
  </SettingsSection>
</template>
