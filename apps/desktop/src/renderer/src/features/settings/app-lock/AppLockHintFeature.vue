<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE } from '@/shared/config';
import { VButton, VInfoNotice } from '@/shared/ui';
import { useLockHint } from './composables/useLockHint.ts';

const router = useRouter();
const { visible, dismiss } = useLockHint();
</script>

<template>
  <div v-if="visible" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3">
    <VInfoNotice
      :card="false"
      icon="lucide:lock"
      tone="info"
      :title="$t('settings.lock.hintTitle')"
      :subtitle="$t('settings.lock.hintText')"
    />
    <div class="flex gap-2">
      <VButton :text="$t('settings.lock.hintEnable')" @click="router.push({ name: ROUTE.settings, query: { section: 'lock' } })" />
      <VButton variant="neutral" :text="$t('settings.lock.hintLater')" @click="dismiss" />
    </div>
  </div>
</template>
