<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { isImportFrom } from '@contract/import-range.ts';
import { BANKS, BankMark, bankOf, isProviderId } from '@/entities/bank';
import { useQuickUpload } from '@/features/integrations';
import { ROUTE } from '@/shared/config';
import { shortDate, t } from '@/shared/lib';
import { VButton, VPopover } from '@/shared/ui';
import { useFreshnessRequest } from '../api/useFreshnessRequest.ts';
import type { FreshnessRow } from '../types.ts';
import { behindMark, freshnessGroups, uploadFrom } from '../utils.ts';

const { rows, today } = defineProps<{ rows: ReadonlyArray<FreshnessRow>; today: string }>();

const upload = useQuickUpload();
const request = useFreshnessRequest();
const router = useRouter();
const open = ref(false);
const adding = ref(false);
const mark = computed(() => behindMark(rows));
const groups = computed(() => freshnessGroups(rows));

/** A token connection: the usual import, from the day its data ends (it re-reads that day). */
function refresh(row: Readonly<FreshnessRow>): void {
  if (row.until !== null && isImportFrom(row.until, today)) void request.startImport(row.until).catch(() => undefined);
}

/** A file connection: the upload sheet bound to it, from the day after its data ends. */
function uploadTo(row: Readonly<FreshnessRow>): void {
  open.value = false;
  const from = uploadFrom(row);
  void upload.pick({ connectionId: row.connectionId, provider: row.provider, ...(from ? { from } : {}) });
}

/** «Add bank»: a file bank opens the sheet with its hint; a token bank is connected in «People and banks». */
function addBank(id: string): void {
  open.value = false;
  adding.value = false;
  if (isProviderId(id) && bankOf(id).ways.includes('file')) void upload.pick({ provider: id });
  else void router.push({ name: ROUTE.settings, query: { section: 'people' } });
}
</script>

<template>
  <!-- Each connection by person and how far its data reaches (spec desktop-data-freshness); the trigger names a bank behind. -->
  <VPopover
    v-model:open="open"
    icon="lucide:chevron-down"
    :text="mark"
    :label="mark ? `${mark}. ${t('home.filters.freshness.list')}` : t('home.filters.freshness.list')"
  >
    <div class="flex w-84 flex-col gap-3 p-1" data-test="freshness-list">
      <p class="text-sm font-medium">{{ $t('home.filters.freshness.list') }}</p>
      <section v-for="g in groups" :key="g.participantId" class="flex flex-col gap-2" :data-test="`freshness-person-${g.participantId}`">
        <p class="text-xs text-foreground-muted">{{ g.person }}</p>
        <ul class="flex flex-col gap-2">
          <li v-for="row in g.rows" :key="row.connectionId" class="flex items-center gap-3 text-sm" :data-test="`freshness-${row.connectionId}`">
            <BankMark :bank="bankOf(row.provider)" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="truncate">{{ row.bank }}</p>
              <p class="text-xs" :class="row.behind ? 'text-warning' : 'text-foreground-muted'">
                {{ row.method === 'token' ? $t('home.filters.freshness.token') : $t('home.filters.freshness.file') }} ·
                {{ row.until ? $t('home.filters.freshness.until', { date: shortDate(row.until) }) : $t('home.filters.freshness.none') }}
              </p>
            </div>
            <VButton
              v-if="row.method === 'file'"
              size="sm"
              variant="neutral"
              :text="uploadFrom(row) ? $t('home.filters.freshness.uploadFrom', { date: shortDate(uploadFrom(row) ?? '') }) : $t('home.filters.freshness.upload')"
              @click="uploadTo(row)"
            />
            <VButton
              v-else-if="row.until !== null"
              size="sm"
              variant="neutral"
              :text="$t('home.filters.freshness.refresh')"
              @click="refresh(row)"
            />
          </li>
        </ul>
      </section>
      <ul v-if="adding" class="flex flex-col gap-1 border-t border-border-subtle pt-2" data-test="freshness-banks">
        <li v-for="b in BANKS" :key="b.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-md p-1 text-left text-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-focus"
            @click="addBank(b.id)"
          >
            <BankMark :bank="b" size="sm" />
            <span class="flex-1">{{ b.name }}</span>
            <span class="text-xs text-foreground-muted">{{ b.ways.map((w) => $t(`home.filters.freshness.${w === 'token' ? 'token' : 'file'}`)).join(' · ') }}</span>
          </button>
        </li>
      </ul>
      <div class="flex flex-wrap justify-between gap-2 border-t border-border-subtle pt-2">
        <VButton size="sm" variant="neutral" icon="lucide:plus" :text="$t('home.filters.freshness.addBank')" :aria-expanded="adding" @click="adding = !adding" />
        <VButton
          size="sm"
          icon="lucide:file-up"
          :text="$t('home.filters.freshness.upload')"
          @click="
            open = false;
            upload.pick();
          "
        />
      </div>
    </div>
  </VPopover>
</template>
