// PrivatBank's rules (src/providers/privatbank/rules.ts): transfers by the bank's category, own transfers by its
// service texts, categories by its table, masking. Fictional texts only.
import { describe, expect, it } from 'vitest';
import { privatbankRules as rules } from '../../../src/providers/privatbank/rules.ts';
import type { RuleContext, RuleTx } from '../../../src/providers/types.ts';

const ctx: RuleContext = { jarTitles: new Set() };
const tx = (bankCategory: string | null, description: string, amount = -100): RuleTx => ({ bankCategory, description, amount, mcc: null });

describe('transfers', () => {
  it('transfer-like by the bank category only', () => {
    expect(rules.isTransferLike(tx('Перекази', 'Вигадана Особа'))).toBe(true);
    expect(rules.isTransferLike(tx('Зарахування переказу', 'від Вигаданий Відправник', 100))).toBe(true);
    expect(rules.isTransferLike(tx('Супермаркети та продукти', 'На свою картку *1234'))).toBe(false);
    expect(rules.isTransferLike(tx(null, 'Вигадана Особа'))).toBe(false);
  });

  it('own transfers: to and from the own card, the jar; counterpart a card for the card texts only', () => {
    const to = tx('Переказ на свою картку', 'На свою картку *1234');
    const from = tx('Зарахування зі своєї картки', 'Зі своєї картки *5678', 100);
    const jar = tx('Заощадження', 'Скарбничка');
    for (const t of [to, from, jar]) {
      expect(rules.isOwnTransferText(t, ctx)).toBe(true);
      expect(rules.isPersonTransfer(t, ctx)).toBe(false);
    }
    expect(rules.ownTransferCounterpart(to, ctx)).toEqual({ kind: 'card', type: 'card', currencyCode: null });
    expect(rules.ownTransferCounterpart(jar, ctx)).toBeNull();
    expect(rules.isOwnTransferText(tx('Перекази', 'Вигадана Особа'), ctx)).toBe(false);
    expect(rules.isPersonTransfer(tx('Перекази', 'Вигадана Особа'), ctx)).toBe(true);
  });

  it('named senders and income sources', () => {
    expect(rules.namedSender('від Вигаданий Відправник')).toEqual({ label: 'від', name: 'Вигаданий Відправник' });
    expect(rules.namedSender('Вигадана Особа')).toBeNull();
    expect(rules.incomeSource(tx('Зарахування переказу', 'від Вигаданий Відправник', 100))).toBe('named_sender');
    expect(rules.incomeSource(tx('Зарахування переказу', 'Вигадана Особа', 100))).toBe('transfer');
    expect(rules.incomeSource(tx('Зарахування', 'Вигаданий магазин', 100))).toBe('other');
  });

  it('a credit outside the transfer categories may be a refund', () => {
    expect(rules.isRefundCredit(tx('Зарахування', 'Вигаданий магазин', 100))).toBe(true);
    expect(rules.isRefundCredit(tx('Зарахування переказу', 'Вигадана Особа', 100))).toBe(false);
  });
});

describe('categories', () => {
  it('from the bank category table; transfers by sign; the treasury as taxes', () => {
    expect(rules.categoryHint(tx('Супермаркети та продукти', 'Вигаданий супермаркет'))).toBe('groceries');
    expect(rules.categoryHint(tx('Таксі', 'Вигадане таксі'))).toBe('transport');
    expect(rules.categoryHint(tx('Перекази', 'Вигадана Особа'))).toBe('p2p');
    expect(rules.categoryHint(tx('Зарахування переказу', 'Вигадана Особа', 100))).toBe('income');
    expect(rules.categoryHint(tx('Платежі за реквізитами', 'ГОЛОВНЕ УДКСУ ВИГАДАНОЇ ОБЛАСТІ'))).toBe('taxes');
    expect(rules.categoryHint(tx('Послуги', 'Вигаданий сервіс'))).toBeNull();
  });

  it('an unknown bank category: no hint, and the table does not know it', () => {
    expect(rules.categoryHint(tx('Вигадана нова категорія', 'Щось'))).toBeNull();
    expect(rules.knowsBankCategory('Вигадана нова категорія')).toBe(false);
    expect(rules.knowsBankCategory('Послуги')).toBe(true);
  });

  it('the treasury, never a business account', () => {
    expect(rules.isTreasury('ГОЛОВНЕ УПРАВЛІННЯ ДЕРЖАВНОЇ КАЗНАЧЕЙСЬКОЇ СЛУЖБИ')).toBe(true);
    expect(rules.isTreasury('Вигаданий магазин')).toBe(false);
    expect(rules.isBusinessAccount({ type: 'card' })).toBe(false);
  });
});

describe('masking', () => {
  it('service texts kept, the card digits replaced; everything else by shape only', () => {
    expect(rules.maskDescription('Скарбничка', ctx)).toEqual({ description: 'Скарбничка', descClass: 'service' });
    expect(rules.maskDescription('Зняття готівки в банкоматі', ctx)).toEqual({ description: 'Зняття готівки в банкоматі', descClass: 'service' });
    expect(rules.maskDescription('На свою картку *1234', ctx)).toEqual({ description: 'На свою картку *9999', descClass: 'service' });
    expect(rules.maskDescription('Зі своєї картки *5678', ctx)).toEqual({ description: 'Зі своєї картки *9999', descClass: 'service' });
    expect(rules.maskDescription('від Вигаданий Відправник', ctx)).toEqual({ description: '[other]', descClass: 'from_prefix' });
    expect(rules.maskDescription('ГОЛОВНЕ УДКСУ ВИГАДАНОЇ ОБЛАСТІ', ctx)).toEqual({ description: '[other]', descClass: 'treasury' });
    expect(rules.maskDescription('+380000000000', ctx)).toEqual({ description: '[other]', descClass: 'other' });
  });
});

describe('the English statement', () => {
  it('categories and transfers by the English bank categories', () => {
    expect(rules.categoryHint(tx('Supermarkets and groceries', 'Made-up Supermarket'))).toBe('groceries');
    expect(rules.categoryHint(tx('Cinema', 'Made-up Cinema'))).toBe('entertainment');
    expect(rules.categoryHint(tx('Transfers', 'Made-up Person'))).toBe('p2p');
    expect(rules.categoryHint(tx('Transfer crediting', 'Made-up Person', 100))).toBe('income');
    expect(rules.categoryHint(tx('Made-up New Category', 'Something'))).toBeNull();
    expect(rules.knowsBankCategory('Made-up New Category')).toBe(false);
    expect(rules.knowsBankCategory('Services')).toBe(true);
  });

  it('own transfers: to and from the own card, the jar', () => {
    const to = tx('Transfer to my card', 'To my card *1234');
    const from = tx('Transfer from my card', 'From my card *5678', 100);
    const jar = tx('Savings', 'Moneybox');
    for (const t of [to, from, jar]) {
      expect(rules.isOwnTransferText(t, ctx)).toBe(true);
      expect(rules.isPersonTransfer(t, ctx)).toBe(false);
    }
    expect(rules.ownTransferCounterpart(from, ctx)).toEqual({ kind: 'card', type: 'card', currencyCode: null });
    expect(rules.ownTransferCounterpart(jar, ctx)).toBeNull();
  });

  it('named senders with the text\'s own label', () => {
    expect(rules.namedSender('from Made-up Sender')).toEqual({ label: 'from', name: 'Made-up Sender' });
    expect(rules.incomeSource(tx('Transfer crediting', 'from Made-up Sender', 100))).toBe('named_sender');
  });

  it('masking keeps the English service texts and masks the rest', () => {
    expect(rules.maskDescription('Moneybox', ctx)).toEqual({ description: 'Moneybox', descClass: 'service' });
    expect(rules.maskDescription('ATM cash withdrawal', ctx)).toEqual({ description: 'ATM cash withdrawal', descClass: 'service' });
    expect(rules.maskDescription('To my card *1234', ctx)).toEqual({ description: 'To my card *9999', descClass: 'service' });
    expect(rules.maskDescription('From my card *5678', ctx)).toEqual({ description: 'From my card *9999', descClass: 'service' });
    expect(rules.maskDescription('from Made-up Sender', ctx)).toEqual({ description: '[other]', descClass: 'from_prefix' });
    expect(rules.maskDescription('ATM Made-up 12345-678, Made-up City', ctx)).toEqual({ description: '[other]', descClass: 'other' });
  });
});
