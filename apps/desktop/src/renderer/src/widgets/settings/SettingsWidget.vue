<script setup lang="ts">
import { AppLockSettingsFeature } from '@/features/app-lock';
import { UpdateSettingsFeature } from '@/features/app-update';
import { AutoSyncSettingsFeature } from '@/features/auto-sync-settings';
import { DbEncryptionFeature } from '@/features/db-encryption';
import { DeleteDataFeature } from '@/features/delete-data';
import { PeopleFeature } from '@/features/people';

const emit = defineEmits<{ deleted: [] }>();
</script>

<template>
  <PeopleFeature />
  <AutoSyncSettingsFeature />
  <AppLockSettingsFeature />
  <DbEncryptionFeature />
  <UpdateSettingsFeature />
  <DeleteDataFeature @deleted="emit('deleted')" />
</template>
