<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { osStoreName } from '@/shared/lib';
import { tokensStorage } from './utils.ts';

const participant = useParticipantStore();

onMounted(() => void participant.refresh().catch(() => undefined));

// The store assumes secure storage until main answers; this screen must not claim it before that.
const tokens = computed(() => tokensStorage(participant.view?.secureStorage ?? null, osStoreName(navigator.userAgent)));
</script>

<template>
  <SettingsSection :title="$t('settings.securityInfo.storage.title')" :description="$t('settings.securityInfo.storage.description')">
    <SettingsList>
      <SettingsRow :title="$t('settings.securityInfo.storage.transactions')" :hint="$t('settings.securityInfo.storage.transactionsHint')" />
      <!-- The database's encryption (db-encryption), composed in by the settings widget. -->
      <slot />
      <SettingsRow v-if="tokens" :title="$t('settings.securityInfo.storage.tokens')" :hint="tokens.hint">
        <span
          class="inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current"
          :class="tokens.ok ? 'bg-success-subtle text-success' : 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning'"
        >
          {{ tokens.badge }}
        </span>
      </SettingsRow>
      <SettingsRow
        :title="$t('settings.securityInfo.storage.importOnLaunch')"
        :hint="$t('settings.securityInfo.storage.importOnLaunchHint')"
      />
    </SettingsList>
  </SettingsSection>
</template>
