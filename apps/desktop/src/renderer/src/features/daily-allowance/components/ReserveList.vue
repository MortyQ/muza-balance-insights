<script setup lang="ts">
import { computed, ref } from 'vue';
import { RESERVES_MAX, type ReserveCurrency, type ReserveInput } from '@contract/allowance.ts';
import { VButton } from '@/shared/ui';
import type { ReserveRowView } from '../types.ts';
import ReserveForm from './ReserveForm.vue';
import ReserveRow from './ReserveRow.vue';

const { rows, currency, owners, owner, today, save, remove } = defineProps<{
  rows: ReadonlyArray<ReserveRowView>;
  /** The screen's currency: a new reserve starts in it. */
  currency: number;
  /** Whom a reserve can belong to (a family of several); empty — no choice. */
  owners: ReadonlyArray<{ id: number; name: string }>;
  /** Whose a new reserve is at first. */
  owner: number | null;
  today: string;
  save: (id: number | null, r: ReserveInput) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
}>();

// One form at a time: 'new', a reserve's id, or none.
const editing = ref<'new' | number | null>(null);
const failed = ref<'save' | 'delete' | null>(null);
const full = computed(() => rows.length >= RESERVES_MAX);
const fresh = computed<ReserveInput>(() => ({ name: '', currency: currency as ReserveCurrency, amount: 0, until: null, participantId: owner }));

function open(what: 'new' | number) {
  failed.value = null;
  editing.value = what;
}
async function submit(id: number | null, input: ReserveInput) {
  if (await save(id, input)) editing.value = null;
  else failed.value = 'save';
}
async function drop(id: number) {
  failed.value = (await remove(id)) ? null : 'delete';
}
</script>

<template>
  <section class="flex flex-col gap-2" :aria-label="$t('home.allowance.reserves.title')">
    <h4 class="text-sm font-semibold">{{ $t('home.allowance.reserves.title') }}</h4>
    <ul v-if="rows.length > 0" class="flex flex-col divide-y divide-border-subtle">
      <template v-for="r in rows" :key="r.id">
        <li v-if="editing === r.id" class="py-2">
          <ReserveForm
            :start="r.input"
            :owners
            :today
            :failed="failed === 'save'"
            @save="(input) => submit(r.id, input)"
            @cancel="editing = null"
          />
        </li>
        <ReserveRow v-else :row="r" @edit="open" @delete="drop" />
      </template>
    </ul>
    <p v-else-if="editing !== 'new'" class="text-sm text-foreground-muted">{{ $t('home.allowance.reserves.empty') }}</p>
    <p v-if="failed === 'delete'" class="text-xs text-danger">{{ $t('home.allowance.reserves.deleteFailed') }}</p>
    <ReserveForm
      v-if="editing === 'new'"
      :start="fresh"
      :owners
      :today
      :failed="failed === 'save'"
      @save="(input) => submit(null, input)"
      @cancel="editing = null"
    />
    <template v-else>
      <p v-if="full" class="text-xs text-foreground-muted">{{ $t('home.allowance.reserves.limit', { max: RESERVES_MAX }) }}</p>
      <VButton v-else type="button" variant="secondary" size="sm" icon="lucide:plus" class="self-start" :text="$t('home.allowance.reserves.add')" @click="open('new')" />
    </template>
  </section>
</template>
