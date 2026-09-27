// The integrations domain: connecting banks and the connections' rows, one folder per bank (monobank) with what they
// share in shared/. The root picks a bank's forms (constants.ts) and holds the sections: «Подключения» in settings and
// the first connect screen.
export { default as ConnectFirstFeature } from './ConnectFirstFeature.vue';
export { default as ConnectionsFeature } from './ConnectionsFeature.vue';
