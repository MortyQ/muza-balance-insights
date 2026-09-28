<script setup lang="ts">
import { VButton, VIcon } from '@/shared/ui';

const { open, title, subtitle, canPrev, canNext } = defineProps<{
  open: boolean;
  /** Title of the open row: «Family cards» / «Accounts · Name». */
  title: string;
  subtitle: string;
  canPrev: boolean;
  canNext: boolean;
}>();
const emit = defineEmits<{ prev: []; next: []; stub: []; close: [] }>();
</script>

<template>
  <!-- Two layers cross-fading in place; the hidden one is inert so its controls cannot be reached. -->
  <div class="relative z-40 h-8">
    <div
      class="absolute inset-0 flex items-center justify-between gap-3 transition-opacity duration-250"
      :class="open ? 'pointer-events-none opacity-0' : 'opacity-100'"
      :inert="open"
    >
      <div class="flex items-baseline gap-3">
        <h3 class="text-base font-bold">{{ $t('home.balances.title') }}</h3>
        <span class="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
          <VIcon icon="lucide:maximize-2" :size="14" />
          {{ $t('home.balances.expandHint') }}
        </span>
      </div>
    </div>
    <div
      class="absolute inset-0 flex items-center justify-between gap-3 transition-opacity duration-250"
      :class="open ? 'opacity-100' : 'pointer-events-none opacity-0'"
      :inert="!open"
    >
      <div class="flex items-baseline gap-2">
        <h3 class="text-base font-bold">{{ title }}</h3>
        <span class="text-xs text-foreground-muted">{{ subtitle }}</span>
      </div>
      <div class="flex items-center gap-2">
        <VButton variant="neutral" size="md" icon="lucide:chevron-left" :aria-label="$t('home.balances.back')" :disabled="!canPrev" @click="emit('prev')" />
        <VButton variant="neutral" size="md" icon="lucide:chevron-right" :aria-label="$t('home.balances.next')" :disabled="!canNext" @click="emit('next')" />
        <VButton variant="primary" size="md" :text="$t('home.balances.allAccounts')" @click="emit('stub')" />
        <VButton variant="neutral" size="md" icon="lucide:x" :text="$t('home.balances.collapse')" @click="emit('close')" />
      </div>
    </div>
  </div>
</template>
