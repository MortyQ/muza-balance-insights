import type { Component } from 'vue';
import type { ProviderId } from '@contract/api.ts';
import MonobankCard from './components/bank/MonobankCard.vue';
import NeutralCard from './components/bank/NeutralCard.vue';

/** The account card of each bank that has a skin of its own. */
export const BANK_CARDS: Readonly<Partial<Record<ProviderId, Component>>> = {
  monobank: MonobankCard,
};

/** The account card of a bank without a skin: the same card without a bank mark. */
export const NEUTRAL_CARD: Component = NeutralCard;
