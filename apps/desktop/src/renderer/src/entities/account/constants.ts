import type { Component } from 'vue';
import type { ProviderId } from '@contract/api.ts';
import ABankCard from './components/bank/ABankCard.vue';
import MonobankCard from './components/bank/MonobankCard.vue';
import NeutralCard from './components/bank/NeutralCard.vue';
import PrivatBankCard from './components/bank/PrivatBankCard.vue';
import SlspCard from './components/bank/SlspCard.vue';

/** The account card of each bank that has a skin of its own. */
export const BANK_CARDS: Readonly<Partial<Record<ProviderId, Component>>> = {
  monobank: MonobankCard,
  privatbank: PrivatBankCard,
  abank: ABankCard,
  slsp: SlspCard,
};

/** The account card of a bank without a skin: the same card on the app's navy, without a wordmark. */
export const NEUTRAL_CARD: Component = NeutralCard;
