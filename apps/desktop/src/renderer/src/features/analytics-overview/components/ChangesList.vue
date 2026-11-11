<script setup lang="ts">
import { VHelpHint, VIcon } from '@/shared/ui';
import type { ChangeRow } from '../types.ts';

const { rows, vs, canCompare } = defineProps<{
  rows: ReadonlyArray<ChangeRow>;
  /** «К окт 2024 – сен 2025»; '' without a comparison. */
  vs: string;
  canCompare: boolean;
}>();
const emit = defineEmits<{ open: [key: string]; all: [] }>();
</script>

<template>
  <section class="flex flex-col">
    <div class="flex items-center gap-1"><h2 class="text-base font-bold">{{ $t('analytics.changes.title') }}</h2><VHelpHint :label="$t('common.helpLabel', { name: $t('analytics.changes.title') })">{{ $t('analytics.help.changes') }}</VHelpHint></div>
    <p v-if="vs" class="text-sm text-foreground-muted">{{ vs }}</p>
    <p v-if="!canCompare" class="mt-3 text-sm text-foreground-muted">{{ $t('analytics.changes.noCompare') }}</p>
    <p v-else-if="rows.length === 0" class="mt-3 text-sm text-foreground-muted">{{ $t('analytics.changes.none') }}</p>
    <ul v-else class="mt-2 flex flex-col">
      <li v-for="(r, i) in rows" :key="r.key" class="border-b border-border-subtle last:border-b-0">
        <p v-if="i === 0 || rows[i - 1]!.up !== r.up" class="pt-3 pb-1 text-xs font-semibold text-foreground-muted" data-test="change-group">
          {{ r.up ? $t('analytics.changes.moreTitle') : $t('analytics.changes.lessTitle') }}
        </p>
        <!-- Spending more is the warning colour here, less a cool neutral one (not «good» green): the reverse of income. -->
        <button
          type="button"
          data-test="change"
          class="flex min-h-12 w-full items-center gap-3 rounded-lg py-2 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
          @click="emit('open', r.key)"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-lg"
            :class="r.up ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info'"
            aria-hidden="true"
          >
            <VIcon :icon="r.up ? 'lucide:arrow-up-right' : 'lucide:arrow-down-right'" class="size-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ r.name }}</span>
            <span v-if="r.why" class="block text-xs text-foreground-muted">{{ r.why }}</span>
          </span>
          <span class="text-right tabular-nums whitespace-nowrap">
            <span class="block font-semibold" :class="r.up ? 'text-danger' : 'text-info'">
              <span class="sr-only">{{ r.up ? $t('analytics.changes.more') : $t('analytics.changes.less') }}</span>{{ r.delta }}
            </span>
            <span v-for="c in r.also" :key="c" class="block text-xs text-foreground-muted" data-test="money-also">{{ c }}</span>
          </span>
        </button>
      </li>
    </ul>
    <button
      v-if="canCompare"
      type="button"
      class="mt-auto self-start pt-3 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-border-focus"
      @click="emit('all')"
    >
      {{ $t('analytics.changes.all') }}
    </button>
  </section>
</template>
