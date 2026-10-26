// The integrations domain: connecting banks and the connections' rows, one folder per bank (monobank) with what they
// share in shared/, and people/ (a person's name and colour). The root picks a bank's forms (constants.ts) and holds the
// sections: «People and banks» in settings (people with their connections by bank), the first connect screen, and the
// data screens' statement upload (button and drop).
export { default as ConnectFirstFeature } from './ConnectFirstFeature.vue';
export { default as PeopleConnectionsFeature } from './PeopleConnectionsFeature.vue';
export { default as QuickUploadButtonFeature } from './QuickUploadButtonFeature.vue';
export { default as QuickUploadFeature } from './QuickUploadFeature.vue';
export { useQuickUpload } from './quick-upload/composables/useQuickUpload.ts';
