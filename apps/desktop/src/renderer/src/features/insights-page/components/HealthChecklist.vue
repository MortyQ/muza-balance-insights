<script setup lang="ts">
import { RouterLink } from 'vue-router';
import type { Standing } from '@contract/api.ts';
import { IntroNote } from '@/shared/layout';
import { categoriesLink } from '@/shared/config';
import { useIntro } from '@/shared/lib';
import { VButton, VHelpHint, VIcon } from '@/shared/ui';
import type { HealthView } from '../types.ts';

// The checklist against guides (spec desktop-insights-health «Checklist against guides», «Standing marks»): the income
// bar of a finished month, then the items in three groups, each figure with a circle, an icon and its standing in words — never colour alone.
const { health } = defineProps<{ health: HealthView }>();
const emit = defineEmits<{ showSignals: [] }>();
const intro = useIntro('budget');
const DIRECTION = { good: 'text-success', bad: 'text-danger', neutral: 'text-foreground-muted' } as const;
const MARK: Readonly<Record<Standing, { icon: string; class: string; value: string }>> = {
  within: { icon: 'lucide:check', class: 'bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-success', value: '' },
  near: { icon: 'lucide:minus', class: 'bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-warning', value: 'text-warning' },
  outside: { icon: 'lucide:x', class: 'bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-danger', value: 'text-danger' },
};
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3" data-test="health-checklist">
    <div class="flex items-baseline justify-between gap-2">
      <div class="flex items-center gap-1.5">
        <h3 class="text-base font-bold">{{ $t('insights.health.checklist.title') }}</h3>
        <VHelpHint :label="$t('insights.budget.helpLabel', { name: $t('insights.health.checklist.title') })" :title="health.budget.basis.title">
          <p v-for="(line, i) in health.budget.basis.lines" :key="i">{{ line }}</p>
        </VHelpHint>
      </div>
      <span v-if="health.count" class="text-xs text-foreground-muted" data-test="health-count">{{ health.count }}</span>
    </div>

    <IntroNote v-if="intro.open.value" :title="$t('insights.budget.intro.title')" @close="intro.close">
      <p>{{ $t('insights.budget.intro.text') }}</p>
    </IntroNote>

    <div v-if="health.budget.parts" class="relative pt-4" aria-hidden="true" data-test="health-bar">
      <span
        v-for="m in health.budget.marks"
        :key="m"
        class="absolute top-0 -translate-x-1/2 text-[0.625rem] text-foreground-muted tabular-nums after:absolute after:left-1/2 after:top-3.5 after:h-5 after:border-l after:border-dashed after:border-foreground-subtle"
        :style="{ left: `${m}%` }"
      >{{ m }}</span>
      <div class="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-sunken">
        <i v-for="p in health.budget.parts" :key="p.key" class="block h-full" :style="{ width: `${p.width}%`, background: p.color }" />
      </div>
    </div>

    <section v-for="g in health.groups" :key="g.key" class="flex flex-col" :aria-label="g.title" :data-test="`health-group-${g.key}`">
      <h4 class="pb-1 pt-1 text-xs font-semibold text-foreground-muted">{{ g.title }}</h4>
      <ul class="flex flex-col">
        <li
          v-for="item in g.items"
          :key="item.key"
          class="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2.5 border-t border-border-subtle py-2"
          :data-test="`health-${item.key}`"
        >
          <span
            class="grid size-6 place-items-center rounded-full"
            :class="item.standing ? MARK[item.standing].class : 'bg-surface-sunken text-foreground-muted'"
            aria-hidden="true"
          >
            <VIcon :icon="item.standing ? MARK[item.standing].icon : 'lucide:clock'" class="size-3.5" />
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="flex items-center gap-1 text-sm">
              <span class="truncate">{{ item.label }}</span>
              <VHelpHint :label="$t('insights.budget.helpLabel', { name: item.label })" :title="item.help.title">
                <p v-for="(line, i) in item.help.lines" :key="i">{{ line }}</p>
              </VHelpHint>
            </span>
            <span class="flex flex-wrap gap-x-2 text-xs">
              <span class="text-foreground-muted">{{ item.note ?? item.guide }}</span>
              <span v-if="item.direction" :class="DIRECTION[item.direction.tone]" data-test="health-direction">{{ item.direction.text }}</span>
              <button
                v-if="item.showSignals"
                type="button"
                class="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
                data-test="health-show-signals"
                @click="emit('showSignals')"
              >
                {{ $t('insights.health.items.strongShow') }}
              </button>
            </span>
          </span>
          <span class="text-right text-sm font-semibold tabular-nums" :class="item.standing ? MARK[item.standing].value : 'text-foreground-muted'">
            {{ item.value }}
            <span v-if="item.standing" class="sr-only" data-test="health-standing">, {{ item.standingText }}</span>
          </span>
        </li>
      </ul>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <RouterLink :to="categoriesLink()" class="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus" data-test="budget-kinds">
        {{ $t('insights.budget.changeKinds') }}
      </RouterLink>
      <VButton v-if="!intro.open.value" variant="link" size="sm" :text="$t('common.howItWorks')" @click="intro.show" />
    </div>
  </section>
</template>
