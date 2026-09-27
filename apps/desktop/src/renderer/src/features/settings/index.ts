// The settings domain: everything the user does with the app and their data on this computer, as sub-features
// (app-lock, app-update, people, auto-sync, db-encryption, db-recovery, delete-data, security-info, theme-switch,
// language-select) with what they share in shared/. Most are sections of the settings screen; some live outside it (the
// lock screen, the home hint and update banner, the first connect screen, the «База недоступна» screen).
export { default as AppLockFeature } from './app-lock/AppLockFeature.vue';
export { default as AppLockHintFeature } from './app-lock/AppLockHintFeature.vue';
export { default as AppLockSettingsFeature } from './app-lock/AppLockSettingsFeature.vue';
export { default as UpdateBannerFeature } from './app-update/UpdateBannerFeature.vue';
export { default as UpdateSettingsFeature } from './app-update/UpdateSettingsFeature.vue';
export { default as ConnectFirstFeature } from './people/ConnectFirstFeature.vue';
export { default as ConnectionsFeature } from './people/ConnectionsFeature.vue';
export { default as PeopleFeature } from './people/PeopleFeature.vue';
export { default as AutoSyncSettingsFeature } from './auto-sync/AutoSyncSettingsFeature.vue';
export { default as DbRecoveryFeature } from './db-recovery/DbRecoveryFeature.vue';
export { default as DbEncryptionFeature } from './db-encryption/DbEncryptionFeature.vue';
export { default as DeleteDataFeature } from './delete-data/DeleteDataFeature.vue';
export { default as NetworkInfoFeature } from './security-info/NetworkInfoFeature.vue';
export { default as StorageInfoFeature } from './security-info/StorageInfoFeature.vue';
export { default as ThemeSwitchFeature } from './theme-switch/ThemeSwitchFeature.vue';
export { LANGUAGE_OPTIONS } from './language-select/constants.ts';
export { useLocale } from './language-select/composables/useLocale.ts';
export type { LanguageOption, UseLocaleReturn } from './language-select/types.ts';
// The layout of a settings section, for sections composed outside the domain («О программе» in the settings widget).
export { default as SettingsList } from './shared/components/SettingsList.vue';
export { default as SettingsRow } from './shared/components/SettingsRow.vue';
export { default as SettingsSection } from './shared/components/SettingsSection.vue';
