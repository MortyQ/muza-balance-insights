<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { IntroNote } from '@/shared/layout';
import { categoriesLink } from '@/shared/config';
import { useIntro } from '@/shared/lib';
import { VButton, VHelpHint } from '@/shared/ui';
import type { BudgetCardView } from '../types.ts';

// «Budget structure» (spec desktop-insights-page): the income bar against 50/30/20, then fixed costs, loan payments and
// the reserve; every figure has a «?» with its formula in the user's numbers. Guides are common advice: no alarm colours.
const { budget } = defineProps<{ budget: BudgetCardView }>();
const intro = useIntro('budget');
</script>

<template>
  <section class="flex flex-col gap-3" data-test="budget-structure">
    <div class="flex items-center gap-1.5">
      <h2 class="text-sm font-bold">{{ $t('insights.budget.title') }}</h2>
      <VHelpHint :label="$t('insights.budget.helpLabel', { name: $t('insights.budget.title') })" :title="budget.basis.title">
        <p v-for="(line, i) in budget.basis.lines" :key="i">{{ line }}</p>
      </VHelpHint>
    </div>
    <IntroNote v-if="intro.open.value" :title="$t('insights.budget.intro.title')" @close="intro.close">
      <p>{{ $t('insights.budget.intro.text') }}</p>
    </IntroNote>

    <template v-if="budget.parts">
      <div class="relative pt-4" aria-hidden="true">
        <span
          v-for="m in budget.marks"
          :key="m"
          class="absolute top-0 -translate-x-1/2 text-[0.625rem] text-foreground-muted tabular-nums after:absolute after:left-1/2 after:top-3.5 after:h-5 after:border-l after:border-dashed after:border-foreground-subtle"
          :style="{ left: `${m}%` }"
        >{{ m }}</span>
        <div class="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-sunken">
          <i v-for="p in budget.parts" :key="p.key" class="block h-full" :style="{ width: `${p.width}%`, background: p.color }" />
        </div>
      </div>
      <ul class="grid grid-cols-3 gap-2" data-test="budget-parts">
        <li v-for="p in budget.parts" :key="p.key" class="flex min-w-0 flex-col gap-0.5 text-xs text-foreground-muted" :data-test="`budget-${p.key}`">
          <span class="flex items-center gap-1">
            <span class="size-2 shrink-0 rounded-full" :style="{ background: p.color }" aria-hidden="true" />
            <span class="truncate">{{ p.label }}</span>
            <VHelpHint :label="$t('insights.budget.helpLabel', { name: p.label })" :title="p.help.title">
              <p v-for="(line, i) in p.help.lines" :key="i">{{ line }}</p>
            </VHelpHint>
          </span>
          <b class="text-base text-foreground tabular-nums">{{ p.share }}</b>
          <span>{{ p.guide }}</span>
        </li>
      </ul>
    </template>
    <p v-else class="text-sm text-foreground-muted" data-test="budget-note">{{ budget.note }}</p>

    <dl class="flex flex-col">
      <div
        v-for="r in budget.rows"
        :key="r.key"
        class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-t border-border-subtle py-2.5"
        :data-test="`budget-${r.key}`"
      >
        <dt class="flex items-center gap-1 text-sm">
          {{ r.label }}
          <VHelpHint :label="$t('insights.budget.helpLabel', { name: r.label })" :title="r.help.title">
            <p v-for="(line, i) in r.help.lines" :key="i">{{ line }}</p>
          </VHelpHint>
        </dt>
        <dd class="text-base font-bold tabular-nums">{{ r.value }}</dd>
        <dd class="col-span-2 text-xs text-foreground-muted">{{ r.guide }}</dd>
      </div>
    </dl>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <RouterLink :to="categoriesLink()" class="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus" data-test="budget-kinds">
        {{ $t('insights.budget.changeKinds') }}
      </RouterLink>
      <VButton v-if="!intro.open.value" variant="link" size="sm" :text="$t('common.howItWorks')" @click="intro.show" />
    </div>
  </section>
</template>
