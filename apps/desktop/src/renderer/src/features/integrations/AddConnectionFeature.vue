<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import type { ProviderKey } from '@contract/api.ts';
import { bankOf } from '@/entities/bank';
import { ColorSwatches, useParticipantStore } from '@/entities/participant';
import { t } from '@/shared/lib';
import { VCheckbox, VInput, VSegmentedControl, VSelect, type SegmentOption, type VSelectOption } from '@/shared/ui';
import { PROVIDER_FORMS, WAY_TEXT, type ConnectWay } from './constants.ts';
import { useConnectionOwner } from './shared/composables/useConnectionOwner.ts';
import FileConnectForm from './statement-file/components/FileConnectForm.vue';

const {
  provider,
  defaultLabel = '',
  submitText = undefined,
  autofocus = false,
} = defineProps<{
  provider: ProviderKey;
  defaultLabel?: string;
  submitText?: string;
  autofocus?: boolean;
}>();
const emit = defineEmits<{ added: [] }>();

const participant = useParticipantStore();
const { person, newLabel, fromBank, personColor, takenPersonColors, owner, reset } = useConnectionOwner(() => defaultLabel);
const personId = useId();

const submitLabel = computed(() => submitText ?? t('integrations.add.submit'));

/** The ways this bank offers; a choice only when there are several (and the app knows how to show them). */
const ways = computed<ReadonlyArray<ConnectWay>>(() => {
  const bank = bankOf(provider);
  return bank.status === 'available' ? bank.ways.filter((w): w is ConnectWay => w === 'token' || w === 'file') : ['token'];
});
const way = ref<ConnectWay>(ways.value[0] ?? 'token');
const wayOptions = computed<SegmentOption<ConnectWay>[]>(() => ways.value.map((w) => ({ label: t(WAY_TEXT[w].label), value: w })));
// A file has no holder's name: «Use the name from the bank» would wait forever.
watch(way, (w) => {
  if (w === 'file') fromBank.value = false;
});
// Only the file form takes the bank: a bank's own form knows it.
const form = computed(() => (way.value === 'file' ? { is: FileConnectForm, provider } : { is: PROVIDER_FORMS[provider].connect }));

const personOptions = computed<VSelectOption[]>(() => [
  ...participant.people.map((p) => ({ label: p.label, value: p.id })),
  { label: t('integrations.add.newPerson'), value: 'new' },
]);

function onAdded() {
  reset();
  emit('added');
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="ways.length > 1" class="flex flex-col gap-2">
      <span class="text-sm font-medium text-foreground-secondary">{{ $t('integrations.way.label') }}</span>
      <div><VSegmentedControl v-model="way" :options="wayOptions" /></div>
      <p class="text-sm text-foreground-muted">{{ $t(WAY_TEXT[way].hint) }}</p>
    </div>
    <!-- The form holds the <form>, its own fields and the submit; whose it is and a new person's colour come first. -->
    <component
      :is="form.is"
      v-bind="'provider' in form ? { provider: form.provider } : {}"
      :owner
      :submit-text="submitLabel"
      :autofocus
      @added="onAdded"
    >
      <div class="flex flex-col gap-2">
        <VSelect :id="personId" v-model="person" :label="$t('integrations.add.whose')" :options="personOptions" class="w-full max-w-[420px]" />
        <template v-if="person === 'new'">
          <VInput
            v-model="newLabel"
            :disabled="fromBank"
            maxlength="80"
            :name="$t('integrations.add.name')"
            :placeholder="$t('integrations.add.namePlaceholder')"
            type="text"
          />
          <VCheckbox v-if="way !== 'file'" v-model="fromBank" :label="$t('integrations.add.fromBank')" />
        </template>
      </div>
      <template v-if="person === 'new'">
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-foreground-secondary">{{ $t('integrations.add.personColor') }}</span>
          <ColorSwatches v-model="personColor" :label="$t('integrations.add.personColor')" :taken="takenPersonColors" />
        </div>
        <p class="-mt-2 text-sm text-foreground-muted">{{ $t('integrations.add.colorNote') }}</p>
      </template>
    </component>
  </div>
</template>
