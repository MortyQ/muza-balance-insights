// The settings domain: everything the user configures, as sub-features (app-lock, app-update, people, auto-sync,
// db-encryption, delete-data) with what they share in shared/. Most are cards of the settings screen; a few live
// outside it too (the lock screen, the home hint and update banner, the first connect screen).
export { default as AppLockFeature } from './app-lock/AppLockFeature.vue';
export { default as AppLockHintFeature } from './app-lock/AppLockHintFeature.vue';
export { default as AppLockSettingsFeature } from './app-lock/AppLockSettingsFeature.vue';
export { default as UpdateBannerFeature } from './app-update/UpdateBannerFeature.vue';
export { default as UpdateSettingsFeature } from './app-update/UpdateSettingsFeature.vue';
export { default as ConnectFirstFeature } from './people/ConnectFirstFeature.vue';
export { default as PeopleFeature } from './people/PeopleFeature.vue';
export { default as AutoSyncSettingsFeature } from './auto-sync/AutoSyncSettingsFeature.vue';
export { default as DbEncryptionFeature } from './db-encryption/DbEncryptionFeature.vue';
export { default as DeleteDataFeature } from './delete-data/DeleteDataFeature.vue';
