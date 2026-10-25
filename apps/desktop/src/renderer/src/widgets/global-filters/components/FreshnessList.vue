<script setup lang="ts">
import { computed } from 'vue';
import { isImportFrom } from '@contract/import-range.ts';
import { useQuickUpload } from '@/features/integrations';
import { shortDate, t } from '@/shared/lib';
import { VButton, VPopover } from '@/shared/ui';
import { useFreshnessRequest } from '../api/useFreshnessRequest.ts';
import type { FreshnessRow } from '../types.ts';
import { behindMark } from '../utils.ts';

const { rows, today } = defineProps<{ rows: ReadonlyArray<FreshnessRow>; today: string }>();

const upload = useQuickUpload();
const request = useFreshnessRequest();
const mark = computed(() => behindMark(rows));

/** A token connection behind: the usual import, from the day its data ends (it re-reads that day). */
function refresh(row: Readonly<FreshnessRow>): void {
  if (row.until !== null && isImportFrom(row.until, today)) void request.startImport(row.until).catch(() => undefined);
}
</script>

<template>
  <!-- Each connection and how far its data reaches (spec desktop-data-freshness); the trigger names a bank behind. -->
  <VPopover icon="lucide:chevron-down" :text="mark" :label="mark ? `${mark}. ${t('home.filters.freshness.list')}` : t('home.filters.freshness.list')">
    <div class="flex w-80 flex-col gap-2 p-1" data-test="freshness-list">
      <p class="text-sm font-medium">{{ $t('home.filters.freshness.list') }}</p>
      <ul class="flex flex-col gap-2">
        <li v-for="row in rows" :key="row.connectionId" class="flex items-center justify-between gap-3 text-sm" :data-test="`freshness-${row.connectionId}`">
          <div class="min-w-0">
            <p class="truncate">{{ row.bank }} · {{ row.person }}</p>
            <p class="text-xs" :class="row.behind ? 'text-warning' : 'text-foreground-muted'">
              {{ row.method === 'token' ? $t('home.filters.freshness.token') : $t('home.filters.freshness.file') }} ·
              {{ row.until ? $t('home.filters.freshness.until', { date: shortDate(row.until) }) : $t('home.filters.freshness.none') }}
            </p>
          </div>
          <VButton
            v-if="row.method === 'file'"
            size="sm"
            variant="neutral"
            icon="lucide:file-up"
            :text="$t('home.filters.freshness.upload')"
            @click="upload.pick"
          />
          <VButton v-else-if="row.behind" size="sm" variant="neutral" icon="lucide:refresh-cw" :text="$t('home.filters.freshness.refresh')" @click="refresh(row)" />
        </li>
      </ul>
    </div>
  </VPopover>
</template>
