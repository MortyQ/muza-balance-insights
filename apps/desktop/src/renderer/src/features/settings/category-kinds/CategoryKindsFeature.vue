<script setup lang="ts">
import { IntroNote, SettingsList, SettingsRow, SettingsSection } from '@/shared/layout';
import { useIntro } from '@/shared/lib';
import { VButton, VInfoNotice, VLoader, VSwitch } from '@/shared/ui';
import CategoryKindRow from './components/CategoryKindRow.vue';
import { useCashCounts } from './composables/useCashCounts.ts';
import { useCategoryKinds } from './composables/useCategoryKinds.ts';

const cash = useCashCounts();
const { rows, anyChanged, error, change, resetAll } = useCategoryKinds(cash.on);
const intro = useIntro('categories');
</script>

<template>
  <SettingsSection :title="$t('settings.categoryKinds.title')" :description="$t('settings.categoryKinds.description')">
    <IntroNote v-if="intro.open.value" :title="$t('settings.categoryKinds.intro.title')" @close="intro.close">
      <p>{{ $t('settings.categoryKinds.intro.kinds') }}</p>
      <p>{{ $t('settings.categoryKinds.intro.fixed') }}</p>
      <p>{{ $t('settings.categoryKinds.intro.where') }}</p>
    </IntroNote>
    <VButton v-else variant="link" size="sm" class="self-start" :text="$t('common.howItWorks')" data-test="intro-show" @click="intro.show" />
    <SettingsList v-if="cash.on.value !== null">
      <SettingsRow :title="$t('settings.categoryKinds.cash')" :hint="$t('settings.categoryKinds.cashHint')" label-for="kinds-cash-counts">
        <VSwitch id="kinds-cash-counts" :model-value="cash.on.value" role="switch" data-test="kinds-cash" @update:model-value="cash.set($event)" />
      </SettingsRow>
    </SettingsList>
    <VInfoNotice v-if="cash.error.value" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="cash.error.value" data-test="kinds-cash-error" />
    <VLoader v-if="rows === null && !error" />
    <SettingsList v-if="rows">
      <CategoryKindRow v-for="row in rows" :key="row.categoryId" :row @change="change(row.categoryId, $event)" />
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    <VButton v-if="anyChanged" variant="neutral" class="self-start" :text="$t('settings.categoryKinds.reset')" data-test="kinds-reset" @click="resetAll" />
  </SettingsSection>
</template>
