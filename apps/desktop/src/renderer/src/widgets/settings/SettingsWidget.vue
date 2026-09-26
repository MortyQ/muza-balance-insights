<script setup lang="ts">
import { AppLockSettingsFeature } from '@/features/app-lock';
import { UpdateSettingsFeature } from '@/features/app-update';
import { DeleteDataFeature } from '@/features/delete-data';
import { PeopleFeature } from '@/features/people';

const emit = defineEmits<{ deleted: [] }>();
</script>

<template>
  <PeopleFeature />
  <AppLockSettingsFeature />
  <UpdateSettingsFeature />
  <DeleteDataFeature @deleted="emit('deleted')" />
</template>
