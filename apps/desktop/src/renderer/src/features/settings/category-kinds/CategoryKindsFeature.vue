<script setup lang="ts">
import { IntroNote, SettingsList, SettingsSection } from '@/shared/layout';
import { useIntro } from '@/shared/lib';
import { VButton, VInfoNotice, VLoader } from '@/shared/ui';
import CategoryKindRow from './components/CategoryKindRow.vue';
import { useCategoryKinds } from './composables/useCategoryKinds.ts';

const { rows, anyChanged, error, change, resetAll } = useCategoryKinds();
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
    <VLoader v-if="rows === null && !error" />
    <SettingsList v-if="rows">
      <CategoryKindRow v-for="row in rows" :key="row.categoryId" :row @change="change(row.categoryId, $event)" />
    </SettingsList>
    <VInfoNotice v-if="error" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="error" />
    <VButton v-if="anyChanged" variant="neutral" class="self-start" :text="$t('settings.categoryKinds.reset')" data-test="kinds-reset" @click="resetAll" />
  </SettingsSection>
</template>
