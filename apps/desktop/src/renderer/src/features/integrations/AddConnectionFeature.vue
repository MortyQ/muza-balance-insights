<script setup lang="ts">
import { computed, useId } from 'vue';
import type { ProviderKey } from '@contract/api.ts';
import { ColorSwatches, useParticipantStore } from '@/entities/participant';
import { t } from '@/shared/lib';
import { VCheckbox, VInput, VSelect, type VSelectOption } from '@/shared/ui';
import { PROVIDER_FORMS } from './constants.ts';
import { useConnectionOwner } from './shared/composables/useConnectionOwner.ts';

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
  <!-- The bank's form holds the <form>, its credential fields and the submit; whose it is and a new person's colour come first. -->
  <component :is="PROVIDER_FORMS[provider].connect" :owner :submit-text="submitLabel" :autofocus @added="onAdded">
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
        <VCheckbox v-model="fromBank" :label="$t('integrations.add.fromBank')" />
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
</template>
