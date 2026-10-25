// The integrations domain: connecting banks and the connections' rows, one folder per bank (monobank) with what they
// share in shared/. The root picks a bank's forms (constants.ts) and holds the sections: «Connections» in settings and
// the first connect screen, and the data screens' statement upload (button and drop).
export { default as ConnectFirstFeature } from './ConnectFirstFeature.vue';
export { default as ConnectionsFeature } from './ConnectionsFeature.vue';
export { default as QuickUploadButtonFeature } from './QuickUploadButtonFeature.vue';
export { default as QuickUploadFeature } from './QuickUploadFeature.vue';
export { useQuickUpload } from './quick-upload/composables/useQuickUpload.ts';
