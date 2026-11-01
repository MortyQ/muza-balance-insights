<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import type { CategoryId } from '@contract/categories.ts';
import { VButton, VIcon, VInput, VSheet, VSwitch } from '@/shared/ui';
import type { PickingLine } from '../types.ts';
import { pickerOptions } from '../utils.ts';

const { line, current, busy } = defineProps<{
  /** The line the picker is for; null — closed. */
  line: PickingLine | null;
  /** The screen's category: where the line is now. */
  current: CategoryId;
  busy: boolean;
}>();
const emit = defineEmits<{ save: [category: CategoryId, payee: boolean]; close: [] }>();

const query = ref('');
const picked = ref<CategoryId | null>(null);
const payee = ref(false);
const switchId = useId();
const options = computed(() => pickerOptions(query.value, current));

// A new line starts clean.
watch(
  () => line?.key,
  () => {
    query.value = '';
    picked.value = null;
    payee.value = false;
  },
);

const open = computed({
  get: () => line !== null,
  set: (v: boolean) => {
    if (!v) emit('close');
  },
});
function save() {
  if (picked.value) emit('save', picked.value, payee.value);
}
</script>

<template>
  <VSheet v-model:open="open" :title="$t('category.picker.title')" :description="line?.merchant ?? ''">
    <div class="flex flex-col gap-3">
      <VInput v-model="query" type="search" icon="lucide:search" :placeholder="$t('category.picker.search')" :aria-label="$t('category.picker.search')" />
      <div role="radiogroup" :aria-label="$t('category.picker.title')" class="flex flex-col">
        <button
          v-for="o in options"
          :key="o.id"
          type="button"
          role="radio"
          :aria-checked="picked === o.id"
          class="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus aria-checked:bg-primary-subtle"
          @click="picked = o.id"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-foreground-secondary" aria-hidden="true">
            <VIcon :icon="o.icon" class="size-4" />
          </span>
          <span class="grow">{{ o.name }}</span>
          <span v-if="o.current" class="text-xs text-foreground-muted">{{ $t('category.picker.current') }}</span>
          <VIcon v-if="picked === o.id" icon="lucide:check" class="size-4 text-primary" />
        </button>
        <p v-if="options.length === 0" class="px-2 py-3 text-foreground-muted">{{ $t('category.picker.none') }}</p>
      </div>
      <div class="flex items-start gap-3 rounded-lg bg-surface-sunken p-3">
        <VSwitch :id="switchId" v-model="payee" role="switch" />
        <label :for="switchId" class="flex cursor-pointer flex-col gap-0.5">
          <span class="font-semibold">{{ $t('category.picker.payee') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('category.picker.payeeHint') }}</span>
        </label>
      </div>
    </div>
    <template #footer>
      <VButton variant="secondary" :text="$t('category.picker.cancel')" @click="emit('close')" />
      <VButton :text="$t('category.picker.save')" :disabled="picked === null || picked === current && !payee" :loading="busy" @click="save" />
    </template>
  </VSheet>
</template>
