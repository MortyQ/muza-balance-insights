<script setup lang="ts">
import {
  AppLockSettingsFeature,
  AutoSyncSettingsFeature,
  DbEncryptionFeature,
  DeleteDataFeature,
  PeopleFeature,
  UpdateSettingsFeature,
} from '@/features/settings';

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
