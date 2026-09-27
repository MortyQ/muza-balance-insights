<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ColorKey, ConnectionView } from '@contract/api.ts';
import { BANKS, BankMark, MONOBANK } from '@/entities/bank';
import { ColorSwatches, colorVar, coverageLine, tokenBadge, tokenLine } from '@/entities/participant';
import { EXPAND_TRANSITION } from '@/shared/lib';
import { VButton } from '@/shared/ui';
import TokenField from './TokenField.vue';

const { connection, secureStorage, takenColors } = defineProps<{
  connection: Readonly<ConnectionView>;
  secureStorage: boolean;
  /** Colours of the other connections → whose they are. */
  takenColors: ReadonlyMap<ColorKey, string>;
}>();
const emit = defineEmits<{
  setToken: [token: string, remember: boolean, done: (saved: boolean) => void];
  color: [color: ColorKey];
  remove: [];
}>();

const bank = computed(() => BANKS.find((b) => b.id === connection.provider) ?? MONOBANK);
const badge = computed(() => tokenBadge(connection.token));
const editing = ref(false);
const coloring = ref(false);
const tokenInput = ref('');
const remember = ref(true);

function toggleToken() {
  editing.value = !editing.value;
  if (editing.value) coloring.value = false;
}

function toggleColor() {
  coloring.value = !coloring.value;
  if (coloring.value) editing.value = false;
}

function pick(color: ColorKey | null) {
  if (color !== null && color !== connection.color) emit('color', color);
}

function save() {
  emit('setToken', tokenInput.value, remember.value, (saved) => {
    if (saved) editing.value = false;
  });
  // The token never stays in the renderer.
  tokenInput.value = '';
}
</script>

<template>
  <div class="flex flex-col px-4 py-3">
    <div class="flex flex-col gap-5">
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <BankMark :bank size="sm" />
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="flex items-center gap-1.5 font-semibold">
              <span
                class="size-2.5 shrink-0 rounded-full bg-(--connection)"
                :style="{ '--connection': colorVar(connection.color) }"
                aria-hidden="true"
              />
              {{ connection.bank }}
            </span>
            <span class="text-sm text-foreground-muted">{{ coverageLine(connection) }}</span>
          </div>
        </div>
        <span
          :title="tokenLine(connection.token)"
          class="inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current"
          :class="
            badge.tone === 'success'
              ? 'bg-success-subtle text-success'
              : 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning'
          "
        >
          {{ badge.text }}
        </span>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <VButton
          :variant="connection.token.present ? 'neutral' : 'primary'"
          :text="editing ? 'Отмена' : connection.token.present ? 'Ввести токен заново' : 'Ввести токен'"
          @click="toggleToken"
        />
        <VButton variant="neutral" icon="lucide:palette" :text="coloring ? 'Готово' : 'Изменить цвет'" :aria-expanded="coloring" @click="toggleColor" />
        <VButton variant="negative" text="Удалить" @click="emit('remove')" />
      </div>
    </div>
    <!-- The gap lives inside the expanding box (pt-5), so nothing jumps when it opens or closes. -->
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="editing" class="grid">
        <div class="-mx-1 min-h-0 overflow-hidden px-1">
          <form class="flex flex-col gap-3 pt-5 pb-1" @submit.prevent="save">
            <TokenField v-model:token="tokenInput" v-model:remember="remember" :bank :secure-storage autofocus />
            <div>
              <VButton type="submit" text="Сохранить" :disabled="tokenInput.trim() === ''" />
            </div>
          </form>
        </div>
      </div>
    </Transition>
    <Transition v-bind="EXPAND_TRANSITION">
      <div v-if="coloring" class="grid">
        <div class="-mx-1 min-h-0 overflow-hidden px-1">
          <div class="flex flex-col gap-2 pt-5 pb-1">
            <span class="text-sm font-medium text-foreground-secondary">Цвет подключения</span>
            <ColorSwatches :model-value="connection.color" label="Цвет подключения" :taken="takenColors" @update:model-value="pick" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
