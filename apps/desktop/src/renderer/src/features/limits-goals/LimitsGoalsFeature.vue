<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { GoalPayload } from '@contract/api.ts';
import { DetailSkeleton } from '@/entities/operations';
import { IntroNote } from '@/shared/layout';
import { useIntro } from '@/shared/lib';
import { VButton, VCard, VIcon, VInfoNotice } from '@/shared/ui';
import BudgetPanel from './components/BudgetPanel.vue';
import BudgetSheet from './components/BudgetSheet.vue';
import GoalRow from './components/GoalRow.vue';
import GoalSheet from './components/GoalSheet.vue';
import LimitRow from './components/LimitRow.vue';
import LimitSheet from './components/LimitSheet.vue';
import { useLimitsGoals } from './composables/useLimitsGoals.ts';
import type { SheetStart } from './types.ts';

// The «Budget» screen (spec desktop-limits-goals): the monthly budget on top, the category limits by what needs
// attention first, suggestions while there are none. Sheets add and edit; home's «Set a budget» opens the budget sheet.
const { openBudget = false } = defineProps<{ openBudget?: boolean }>();
const { state, view, owners, defaultOwner, defaultCurrency, save, remove, addSuggested } = useLimitsGoals();
const intro = useIntro('limits');

const sheet = ref<'limit' | 'budget' | 'goal' | null>(null);
const start = ref<SheetStart | null>(null);
const failed = ref(false);

function newBudget() {
  start.value = { id: null, goal: { type: 'budget', currency: defaultCurrency.value, amount: 0, participantId: defaultOwner.value, fixed: [] } };
  failed.value = false;
  sheet.value = 'budget';
}
function editBudget() {
  const b = state.value.data?.budget;
  if (!b) return;
  start.value = {
    id: b.id,
    goal: { type: 'budget', currency: b.currency, amount: b.amountMinor, participantId: b.owner, fixed: b.fixed.map((r) => ({ categoryId: r.categoryId, amount: r.amountMinor })), countTaxes: b.countTaxes },
  };
  failed.value = false;
  sheet.value = 'budget';
}
function newLimit() {
  start.value = { id: null, goal: { type: 'limit', categoryId: 'cafes', period: 'month', currency: defaultCurrency.value, amount: 0, participantId: defaultOwner.value } };
  failed.value = false;
  sheet.value = 'limit';
}
function editLimit(id: number) {
  const l = state.value.data?.limits.find((x) => x.id === id);
  if (!l) return;
  start.value = { id, goal: { type: 'limit', categoryId: l.categoryId, period: l.period, currency: l.currency, amount: l.amountMinor, participantId: l.owner } };
  failed.value = false;
  sheet.value = 'limit';
}
function newGoal() {
  start.value = {
    id: null,
    goal: { type: 'saving', name: '', currency: defaultCurrency.value, amount: 0, participantId: defaultOwner.value, until: null, source: 'jar', accountId: null },
  };
  failed.value = false;
  sheet.value = 'goal';
}
function editGoal(id: number) {
  const g = state.value.data?.savings.find((x) => x.id === id);
  if (!g) return;
  start.value = { id, goal: { type: 'saving', name: g.name, currency: g.currency, amount: g.amountMinor, participantId: g.owner, until: g.until, source: g.source, accountId: g.accountId } };
  failed.value = false;
  sheet.value = 'goal';
}
async function onSave(id: number | null, g: GoalPayload) {
  failed.value = !(await save(id, g));
  if (!failed.value) sheet.value = null;
}
async function onDelete(id: number) {
  failed.value = !(await remove(id));
  if (!failed.value) sheet.value = null;
}
onMounted(() => {
  if (openBudget) newBudget();
});
</script>

<template>
  <div class="@container flex flex-col gap-4" data-test="limits-screen">
    <IntroNote v-if="intro.open.value" :title="$t('limits.intro.title')" @close="intro.close">
      <p>{{ $t('limits.intro.budget') }}</p>
      <p>{{ $t('limits.intro.limits') }}</p>
      <p>{{ $t('limits.intro.counted') }}</p>
    </IntroNote>
    <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('limits.failed')" />
    <DetailSkeleton v-if="!view && state.status === 'loading'" />
    <template v-else-if="view && state.data">
      <BudgetPanel v-if="view.budget" :panel="view.budget" @edit="editBudget" />
      <VCard v-else padding="md" data-test="budget-empty">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary"><VIcon icon="lucide:wallet" class="size-5" /></span>
            <div>
              <p class="font-semibold">{{ $t('limits.budget.emptyTitle') }}</p>
              <p class="text-sm text-foreground-muted">{{ $t('limits.budget.emptyText') }}</p>
            </div>
          </div>
          <VButton variant="primary" :text="$t('limits.budget.create')" data-test="budget-create" @click="newBudget" />
        </div>
      </VCard>

      <VCard padding="md">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-bold">{{ $t('limits.listTitle') }}</h2>
            <VButton variant="neutral" size="sm" icon="lucide:plus" :text="$t('limits.add')" data-test="limit-add" @click="newLimit" />
          </div>
          <ul v-if="view.limits.length > 0" class="flex flex-col divide-y divide-border-subtle">
            <LimitRow v-for="row in view.limits" :key="row.id" :row @edit="editLimit(row.id)" />
          </ul>
          <div v-else-if="view.suggestions.length > 0" class="flex flex-col gap-3 py-2" data-test="suggestions">
            <p class="text-sm text-foreground-secondary">{{ $t('limits.suggest.text') }}</p>
            <ul class="flex flex-wrap gap-2">
              <li v-for="s in view.suggestions" :key="s.categoryId" class="rounded-full bg-surface-sunken px-3 py-1 text-sm tabular-nums">{{ s.name }} · {{ s.amount }}</li>
            </ul>
            <VButton variant="primary" size="sm" class="self-start" :text="$t('limits.suggest.add')" data-test="suggest-add" @click="addSuggested" />
          </div>
          <p v-else class="py-2 text-sm text-foreground-muted">{{ view.early ? $t('limits.suggest.early') : $t('limits.none') }}</p>
        </div>
      </VCard>
      <VCard padding="md" data-test="goals">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-bold">{{ $t('limits.goals.title') }}</h2>
            <VButton variant="neutral" size="sm" icon="lucide:plus" :text="$t('limits.goals.add')" data-test="goal-add" @click="newGoal" />
          </div>
          <ul v-if="view.goals.length > 0" class="flex flex-col divide-y divide-border-subtle">
            <GoalRow v-for="row in view.goals" :key="row.id" :row @edit="editGoal(row.id)" />
          </ul>
          <p v-else class="py-2 text-sm text-foreground-muted">{{ $t('limits.goals.none') }}</p>
        </div>
      </VCard>
      <VButton v-if="!intro.open.value" variant="link" size="sm" class="self-start" :text="$t('common.howItWorks')" @click="intro.show" />

      <LimitSheet :open="sheet === 'limit'" :start :overview="state.data" :owners :failed @update:open="(v: boolean) => !v && (sheet = null)" @save="onSave" @delete="onDelete" />
      <GoalSheet :open="sheet === 'goal'" :start :overview="state.data" :owners :failed @update:open="(v: boolean) => !v && (sheet = null)" @save="onSave" @delete="onDelete" />
      <BudgetSheet :open="sheet === 'budget'" :start :overview="state.data" :owners :failed @update:open="(v: boolean) => !v && (sheet = null)" @save="onSave" @delete="onDelete" />
    </template>
  </div>
</template>
