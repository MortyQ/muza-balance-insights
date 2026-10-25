<script setup lang="ts">
import { computed, onMounted, useId } from 'vue';
import type { ConnectionView, OpenedStatementView, OpenStatementResult } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import { cardTypeName, cardTypesOf } from '@/entities/bank';
import { t } from '@/shared/lib';
import { VButton, VInfoNotice, VSelect, type VSelectOption } from '@/shared/ui';
import { accountLabel } from '../shared/utils.ts';
import { useStatementUpload } from './composables/useStatementUpload.ts';
import { comparisonLines, statementLabel, summaryText } from './utils.ts';

const { connection, steps, opened = null } = defineProps<{
  connection: Readonly<ConnectionView>;
  /** How to get the file, step by step. */
  steps: ReadonlyArray<MessageKey>;
  /** A file main already opened for this connection (the data screens' upload): compared at once. */
  opened?: Readonly<OpenStatementResult> | null;
}>();

const id = useId();
const { state, targets, newTypes, canAdd, open, adopt, add } = useStatementUpload(() => connection);
onMounted(() => {
  if (opened) void adopt(opened);
});
const fileConnection = computed(() => connection.method === 'file');

const file = computed(() => (state.value.step === 'opened' || state.value.step === 'writing' ? state.value.file : null));
const comparison = computed(() => (state.value.step === 'opened' || state.value.step === 'writing' ? state.value.comparison : null));

/** A card of the connection goes to one account of the file: the cards other rows took are not offered. */
function accountOptions(s: Readonly<OpenedStatementView>, i: number): VSelectOption[] {
  const takenElsewhere = new Set(targets.value.filter((_, j) => j !== i));
  return [
    ...s.accounts.filter((a) => !takenElsewhere.has(a.id)).map((a) => ({ label: accountLabel(a, connection.provider), value: a.id })),
    // A token connection's file is only compared: there is no new card to write it to.
    ...(fileConnection.value ? [{ label: t('integrations.statement.newCard'), value: 'new' }] : []),
  ];
}
// A bank that names no card types gives its new cards none: there is nothing to pick.
const typeOptions = computed<VSelectOption[]>(() => cardTypesOf(connection.provider).map((value) => ({ label: cardTypeName(connection.provider, value), value })));
</script>

<template>
  <div class="flex flex-col gap-3">
    <ol v-if="steps.length > 0" class="list-decimal pl-5 text-sm text-foreground-secondary">
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
      <section v-for="(s, i) in file.statements" :key="i" class="flex flex-col gap-2">
        <p class="text-sm font-medium">{{ statementLabel(s, connection.provider) }}</p>
        <p class="text-sm">{{ summaryText(s) }}</p>
        <div class="flex flex-wrap gap-3">
          <VSelect :id="`${id}-account-${i}`" v-model="targets[i]" :label="$t('integrations.statement.account')" :options="accountOptions(s, i)" class="w-72" />
          <VSelect
            v-if="targets[i] === 'new' && typeOptions.length > 0"
            :id="`${id}-type-${i}`"
            v-model="newTypes[i]"
            :label="$t('integrations.statement.cardType')"
            :options="typeOptions"
            class="w-48"
          />
        </div>
        <ul v-if="comparison?.status === 'ready' && comparison.comparisons[i]" class="flex flex-col gap-1 text-sm">
          <li v-for="line in comparisonLines(comparison.comparisons[i])" :key="line">{{ line }}</li>
        </ul>
      </section>
      <p v-if="comparison?.status === 'loading'" class="text-sm text-foreground-muted">{{ $t('integrations.statement.comparing') }}</p>
      <VInfoNotice v-else-if="comparison?.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="comparison.message" />
      <div v-if="fileConnection">
        <VButton :text="$t('integrations.statement.add')" :loading="state.step === 'writing'" :disabled="!canAdd" @click="add" />
      </div>
    </template>

    <VInfoNotice v-if="state.step === 'problem'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="state.message" />
    <VInfoNotice v-if="state.step === 'done'" :card="false" icon="lucide:check-circle" tone="success" :subtitle="state.message" />
  </div>
</template>
