<script setup lang="ts">
import { computed, nextTick, useId, useTemplateRef, watch } from 'vue';
import { MoneyStack } from '@/entities/currency-display';
import { osFamily } from '@/shared/lib';
import { VIcon, VSheet } from '@/shared/ui';
import { useGlobalSearch } from './composables/useGlobalSearch.ts';

const { open, input, status, groups, items, active, understood, more, onKey, pick } = useGlobalSearch();
const listId = useId();
const field = useTemplateRef<HTMLInputElement>('field');
const mac = osFamily(navigator.userAgent) === 'mac';
const activeId = computed(() => {
  const item = items.value[active.value];
  return item ? `${listId}-${item.id}` : undefined;
});
const indexOf = (id: string) => items.value.findIndex((i) => i.id === id);

watch(open, async (o) => {
  if (!o) return;
  await nextTick();
  field.value?.focus();
});
// The highlighted row stays in view while the arrows walk the list.
watch(activeId, async (id) => {
  if (!id) return;
  await nextTick();
  document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
});
</script>

<template>
  <button
    type="button"
    class="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-border-subtle bg-surface-sunken px-2.5 text-sm text-foreground-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
    :aria-label="$t('search.label')"
    data-test="search-open"
    @click="open = true"
  >
    <VIcon icon="lucide:search" :size="14" />
    <span class="hidden xl:inline">{{ $t('search.open') }}</span>
    <kbd class="rounded border border-border-subtle px-1 font-sans text-xs">{{ mac ? $t('search.shortcutMac') : $t('search.shortcutOther') }}</kbd>
  </button>

  <VSheet v-model:open="open" :title="$t('search.title')">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 focus-within:outline-2 focus-within:outline-border-focus">
        <VIcon icon="lucide:search" :size="16" class="shrink-0 text-foreground-muted" />
        <input
          ref="field"
          v-model="input"
          type="search"
          class="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-muted"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="items.length > 0"
          :aria-controls="listId"
          :aria-activedescendant="activeId"
          :aria-label="$t('search.label')"
          :placeholder="$t('search.placeholder')"
          autocomplete="off"
          spellcheck="false"
          data-test="search-input"
          @keydown="onKey"
        />
      </div>
      <p v-if="understood" class="text-xs text-foreground-muted" data-test="search-understood">{{ understood }}</p>

      <p v-if="status === 'idle'" class="text-sm text-foreground-muted">{{ $t('search.hint') }}</p>
      <p v-else-if="status === 'loading' && items.length === 0" class="text-sm text-foreground-muted" role="status">{{ $t('search.searching') }}</p>
      <p v-else-if="status === 'error'" class="text-sm text-danger" role="alert">{{ $t('search.failed') }}</p>
      <p v-else-if="status === 'done' && items.length === 0" class="text-sm text-foreground-muted" role="status" data-test="search-empty">
        {{ $t('search.empty', { query: input.trim() }) }}
      </p>

      <div :id="listId" role="listbox" :aria-label="$t('search.label')" class="flex flex-col gap-3" :class="{ 'opacity-60': status === 'loading' }">
        <section v-for="g in groups" :key="g.id" role="group" :aria-labelledby="`${listId}-${g.id}`" :data-group="g.id">
          <h3 :id="`${listId}-${g.id}`" class="px-1.5 pb-1 text-xs font-bold text-foreground-muted">{{ g.title }}</h3>
          <div
            v-for="item in g.items"
            :id="`${listId}-${item.id}`"
            :key="item.id"
            role="option"
            :aria-selected="activeId === `${listId}-${item.id}`"
            class="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-surface-hover"
            :class="{ 'bg-surface-hover': activeId === `${listId}-${item.id}` }"
            data-test="search-item"
            @mousemove="active = indexOf(item.id)"
            @click="pick(item)"
          >
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken">
              <VIcon :icon="item.icon" class="size-3.5 text-foreground-muted" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate">{{ item.title }}</span>
              <span v-if="item.caption" class="truncate text-xs text-foreground-muted">{{ item.caption }}</span>
            </span>
            <MoneyStack v-if="item.amount" :amount="item.amount" :also="item.also" :strong="false">
              <span :class="{ 'text-success': item.incoming }">{{ item.amount }}</span>
            </MoneyStack>
          </div>
        </section>
      </div>
      <p v-if="more" class="text-xs text-foreground-muted">{{ more }}</p>
    </div>
  </VSheet>
</template>
