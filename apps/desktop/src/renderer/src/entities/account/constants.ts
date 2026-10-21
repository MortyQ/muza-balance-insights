import type { Component } from 'vue';
import MonobankCard from './components/bank/MonobankCard.vue';
import type { CardBank } from './types.ts';

/** The account card of each bank; `Record` keeps a bank without a skin from building. */
export const BANK_CARDS: Readonly<Record<CardBank, Component>> = {
  monobank: MonobankCard,
};
