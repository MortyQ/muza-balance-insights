<script setup lang="ts">
const { titles, first, last, shown } = defineProps<{
  /** The cards' titles, in row order. */
  titles: ReadonlyArray<string>;
  /** The cards in view. */
  first: number;
  last: number;
  /** Open and not everything fits; hidden, the place is kept so opening does not shift the block. */
  shown: boolean;
}>();
const emit = defineEmits<{ go: [i: number] }>();
</script>

<template>
  <!-- Where the open row stands, in place of a scroll bar: a dot per card, the cards in view as a longer pill. -->
  <div
    class="flex h-4 items-center justify-center gap-0.5 transition-opacity duration-300"
    :class="shown ? 'opacity-100' : 'pointer-events-none opacity-0'"
    :inert="!shown"
    :aria-hidden="!shown"
  >
    <button
      v-for="(title, i) in titles"
      :key="i"
      type="button"
      data-test="row-dot"
      class="group grid h-4 place-items-center rounded-full px-1 focus-visible:outline-2 focus-visible:outline-border-focus"
      :aria-label="$t('home.balances.toCard', { n: i + 1, total: titles.length, title })"
      :aria-current="i === first ? 'true' : undefined"
      @click="emit('go', i)"
    >
      <span
        class="block h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none"
        :class="i >= first && i <= last ? 'w-4 bg-foreground-muted' : 'w-1.5 bg-border-strong group-hover:bg-foreground-subtle'"
      />
    </button>
  </div>
</template>
