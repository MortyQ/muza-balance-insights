// The settings domain: everything the user does with the app and their data on this computer, as sub-features
// (app-lock, app-update, people, auto-sync, db-encryption, db-recovery, delete-data) with what they share in shared/.
// Most are cards of the settings screen; some live outside it (the lock screen, the home hint and update banner, the
// first connect screen, the «База недоступна» screen).
export { default as AppLockFeature } from './app-lock/AppLockFeature.vue';
export { default as AppLockHintFeature } from './app-lock/AppLockHintFeature.vue';
export { default as AppLockSettingsFeature } from './app-lock/AppLockSettingsFeature.vue';
export { default as UpdateBannerFeature } from './app-update/UpdateBannerFeature.vue';
export { default as UpdateSettingsFeature } from './app-update/UpdateSettingsFeature.vue';
export { default as ConnectFirstFeature } from './people/ConnectFirstFeature.vue';
export { default as PeopleFeature } from './people/PeopleFeature.vue';
export { default as AutoSyncSettingsFeature } from './auto-sync/AutoSyncSettingsFeature.vue';
export { default as DbRecoveryFeature } from './db-recovery/DbRecoveryFeature.vue';
export { default as DbEncryptionFeature } from './db-encryption/DbEncryptionFeature.vue';
export { default as DeleteDataFeature } from './delete-data/DeleteDataFeature.vue';
