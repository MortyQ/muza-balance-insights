<script setup lang="ts">
import { computed } from 'vue';
import { currencyAlpha } from '@mono/core/shared/currency';
import type { PersonView, ProviderId, UploadAccountView } from '@contract/api.ts';
import { BankMark, bankOf, cardTypeName } from '@/entities/bank';
import { shortDate, t } from '@/shared/lib';
import { VSelect, type VSelectOption } from '@/shared/ui';

const { provider, account, people, choice } = defineProps<{
  provider: ProviderId;
  account: Readonly<UploadAccountView>;
  people: ReadonlyArray<PersonView>;
  /** The person picked for an account no connection has; null — none yet (or a matched account). */
  choice: number | null;
}>();
const emit = defineEmits<{ choose: [participantId: number] }>();

const bank = computed(() => bankOf(provider));
const title = computed(() =>
  [bank.value.name, account.cardTail === null ? cardTypeName(provider, account.type) : `•• ${account.cardTail}`, currencyAlpha(account.currencyCode)].join(' · '),
);
const owner = computed(() => (account.match === null ? null : (people.find((p) => p.id === account.match?.participantId)?.label ?? null)));
const personOptions = computed<VSelectOption[]>(() => people.map((p) => ({ label: p.label, value: p.id })));
const picked = computed<string | number | null>({
  get: () => choice,
  set: (v) => {
    if (typeof v === 'number') emit('choose', v);
  },
});
const blocked = computed(() =>
  account.blocked === 'token'
    ? t('integrations.quick.checkOnly')
    : account.blocked === 'currency'
      ? t('integrations.statement.blockedCurrency')
      : account.blocked === 'gap'
        ? t('integrations.quick.gap')
        : '',
);
</script>

<template>
  <li class="flex flex-col gap-2 border-t border-border-subtle py-3 first:border-t-0" data-test="upload-card">
    <div class="flex items-start gap-3">
      <BankMark :bank="bank" size="sm" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ title }}</p>
        <p class="text-xs text-foreground-muted">{{ shortDate(account.from) }} – {{ shortDate(account.to) }}</p>
        <p class="text-xs text-foreground-muted" data-test="upload-counts">
          {{ $t('integrations.statement.counts', { matched: account.matched, added: account.added }) }}
        </p>
      </div>
      <span v-if="owner" class="shrink-0 text-sm" data-test="upload-owner">{{ owner }}</span>
    </div>
    <p v-if="blocked" class="text-xs text-warning" data-test="upload-blocked">{{ blocked }}</p>
    <VSelect
      v-else-if="account.match === null"
      v-model="picked"
      class="max-w-60"
      :options="personOptions"
      :label="$t('integrations.quick.whose')"
      :placeholder="$t('integrations.quick.choosePerson')"
      data-test="upload-whose"
    />
  </li>
</template>
