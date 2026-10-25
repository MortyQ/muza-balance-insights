<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PersonView, ProviderId } from '@contract/api.ts';
import { bankOf } from '@/entities/bank';
import { VButton, VSelect, type VSelectOption } from '@/shared/ui';
import type { ConnectionOption } from '../types.ts';

const { provider, files, tokens, people, busy } = defineProps<{
  provider: ProviderId;
  /** File connections of the file's bank: the file is written to the one picked. */
  files: ReadonlyArray<ConnectionOption>;
  /** Token connections of that bank: the file is only checked against them. */
  tokens: ReadonlyArray<ConnectionOption>;
  people: ReadonlyArray<PersonView>;
  busy: boolean;
}>();

const emit = defineEmits<{ choose: [option: ConnectionOption]; add: [participantId: number | null] }>();

const bank = computed(() => bankOf(provider).name);
const personOptions = computed<VSelectOption[]>(() => people.map((p) => ({ label: p.label, value: p.id })));
const person = ref<string | number | null>(people[0]?.id ?? null);
</script>

<template>
  <div class="flex flex-col gap-3">
    <template v-if="files.length > 0">
      <p class="text-sm">{{ $t('integrations.quick.chooseConnection') }}</p>
      <div class="flex flex-wrap gap-2">
        <VButton v-for="o in files" :key="o.connection.id" variant="neutral" :text="o.label" :disabled="busy" @click="emit('choose', o)" />
      </div>
    </template>
    <template v-else>
      <p class="text-sm">{{ $t('integrations.quick.noConnection', { bank }) }}</p>
      <div class="flex flex-wrap items-end gap-3">
        <VSelect v-if="personOptions.length > 1" v-model="person" :label="$t('integrations.quick.person')" :options="personOptions" class="w-56" />
        <VButton
          :text="$t('integrations.quick.addConnection')"
          :loading="busy"
          @click="emit('add', typeof person === 'number' ? person : null)"
        />
      </div>
    </template>
    <template v-if="tokens.length > 0">
      <p class="text-sm text-foreground-secondary">{{ $t('integrations.quick.compareOnly', { bank }) }}</p>
      <div class="flex flex-wrap gap-2">
        <VButton v-for="o in tokens" :key="o.connection.id" variant="neutral" :text="o.label" :disabled="busy" @click="emit('choose', o)" />
      </div>
    </template>
  </div>
</template>
