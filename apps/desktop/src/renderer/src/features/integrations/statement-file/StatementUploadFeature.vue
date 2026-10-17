<script setup lang="ts">
import { computed, useId } from 'vue';
import type { ConnectionView } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import { t } from '@/shared/lib';
import { VButton, VInfoNotice, VSelect, type VSelectOption } from '@/shared/ui';
import { accountLabel } from '../shared/utils.ts';
import { useStatementUpload } from './composables/useStatementUpload.ts';
import { comparisonLines, summaryText } from './utils.ts';

const { connection, cardTypes, steps } = defineProps<{
  connection: Readonly<ConnectionView>;
  /** The bank's card types → dictionary keys of their names. */
  cardTypes: Readonly<Record<string, MessageKey>>;
  /** How to get the file, step by step. */
  steps: ReadonlyArray<MessageKey>;
}>();

const id = useId();
const { state, target, newType, canAdd, open, add } = useStatementUpload(() => connection);
const fileConnection = computed(() => connection.method === 'file');

const file = computed(() => (state.value.step === 'opened' || state.value.step === 'writing' ? state.value.file : null));
const comparison = computed(() => (state.value.step === 'opened' || state.value.step === 'writing' ? state.value.comparison : null));

const accountOptions = computed<VSelectOption[]>(() => [
  ...(file.value?.accounts ?? []).map((a) => ({ label: accountLabel(a, cardTypes), value: a.id })),
  // A token connection's file is only compared: there is no new card to write it to.
  ...(fileConnection.value ? [{ label: t('integrations.statement.newCard'), value: 'new' }] : []),
]);
const typeOptions = computed<VSelectOption[]>(() => Object.entries(cardTypes).map(([value, key]) => ({ label: t(key), value })));
</script>

<template>
  <div class="flex flex-col gap-3">
    <ol class="list-decimal pl-5 text-sm text-foreground-secondary">
      <li v-for="step in steps" :key="step">{{ $t(step) }}</li>
    </ol>
    <div>
      <VButton
        :variant="file ? 'neutral' : 'primary'"
        :text="$t('integrations.statement.pick')"
        icon="lucide:file-up"
        :loading="state.step === 'opening'"
        @click="open"
      />
    </div>

    <template v-if="file">
      <p class="text-sm">{{ summaryText(file) }}</p>
      <div class="flex flex-wrap gap-3">
        <VSelect :id="`${id}-account`" v-model="target" :label="$t('integrations.statement.account')" :options="accountOptions" class="w-72" />
        <VSelect
          v-if="target === 'new'"
          :id="`${id}-type`"
          v-model="newType"
          :label="$t('integrations.statement.cardType')"
          :options="typeOptions"
          class="w-48"
        />
      </div>
      <p v-if="comparison?.status === 'loading'" class="text-sm text-foreground-muted">{{ $t('integrations.statement.comparing') }}</p>
      <VInfoNotice v-else-if="comparison?.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="comparison.message" />
      <ul v-else-if="comparison?.status === 'ready'" class="flex flex-col gap-1 text-sm">
        <li v-for="line in comparisonLines(comparison.comparison)" :key="line">{{ line }}</li>
      </ul>
      <div v-if="fileConnection">
        <VButton :text="$t('integrations.statement.add')" :loading="state.step === 'writing'" :disabled="!canAdd" @click="add" />
      </div>
    </template>

    <VInfoNotice v-if="state.step === 'problem'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="state.message" />
    <VInfoNotice v-if="state.step === 'done'" :card="false" icon="lucide:check-circle" tone="success" :subtitle="state.message" />
  </div>
</template>
