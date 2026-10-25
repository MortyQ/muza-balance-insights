<script setup lang="ts">
import { VButton } from '@/shared/ui';
import { useQuickUpload } from './quick-upload/composables/useQuickUpload.ts';

const { state, pick } = useQuickUpload();
</script>

<template>
  <!-- The data screens' «Upload statement»: the file names its bank; the window's QuickUploadFeature shows the rest. -->
  <VButton variant="neutral" size="sm" icon="lucide:file-up" :text="$t('integrations.quick.button')" :loading="state.step === 'opening'" @click="pick" />
</template>
