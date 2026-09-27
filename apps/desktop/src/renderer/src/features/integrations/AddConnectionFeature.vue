<script setup lang="ts">
import { computed, useId } from 'vue';
import type { ProviderKey } from '@contract/api.ts';
import { ColorSwatches, useParticipantStore } from '@/entities/participant';
import { VCheckbox, VInput, VSelect, type VSelectOption } from '@/shared/ui';
import { PROVIDER_FORMS } from './constants.ts';
import { useConnectionOwner } from './shared/composables/useConnectionOwner.ts';

const {
  provider = 'monobank',
  defaultLabel = '',
  submitText = 'Подключить',
  autofocus = false,
} = defineProps<{
  provider?: ProviderKey;
  defaultLabel?: string;
  submitText?: string;
  autofocus?: boolean;
}>();
const emit = defineEmits<{ added: [] }>();

const participant = useParticipantStore();
const { person, newLabel, fromBank, personColor, connectionColor, takenPersonColors, takenConnectionColors, owner, reset } = useConnectionOwner(
  () => defaultLabel,
);
const personId = useId();

const personOptions = computed<VSelectOption[]>(() => [
  ...participant.people.map((p) => ({ label: p.label, value: p.id })),
  { label: 'Новый человек', value: 'new' },
]);

function onAdded() {
  reset();
  emit('added');
}
</script>

<template>
  <!-- The bank's form holds the <form>, its credential fields and the submit; whose it is and the colours come first. -->
  <component :is="PROVIDER_FORMS[provider].connect" :owner :connection-color="connectionColor" :submit-text :autofocus @added="onAdded">
    <div class="flex flex-col gap-2">
      <VSelect :id="personId" v-model="person" label="Чьи это счета" :options="personOptions" class="w-full max-w-[420px]" />
      <template v-if="person === 'new'">
        <VInput
          v-model="newLabel"
          :disabled="fromBank"
          maxlength="80"
          name="Имя"
          placeholder="Имя, например «Я» или «Оля»"
          type="text"
        />
        <VCheckbox v-model="fromBank" label="Взять имя из банка (подставится при первом импорте)" />
      </template>
    </div>
    <div class="flex flex-wrap gap-x-10 gap-y-4">
      <div v-if="person === 'new'" class="flex flex-col gap-2">
        <span class="text-sm font-medium text-foreground-secondary">Цвет человека</span>
        <ColorSwatches v-model="personColor" label="Цвет человека" :taken="takenPersonColors" />
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-foreground-secondary">Цвет подключения</span>
        <ColorSwatches v-model="connectionColor" label="Цвет подключения" :taken="takenConnectionColors" />
      </div>
    </div>
    <p class="-mt-2 text-sm text-foreground-muted">По цвету человека и подключения их будет легко различать на графиках. Цвет можно сменить позже.</p>
  </component>
</template>
