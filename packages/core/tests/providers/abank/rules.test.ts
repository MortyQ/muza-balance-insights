// A-Bank's rules (src/providers/abank/rules.ts): the MCC decides, the cashback credit is income, cancellations are
// refunds, `MONO*` names its sender; masking keeps service texts and prefixes only. Fictional texts only.
import { describe, expect, it } from 'vitest';
import { abankRules as rules } from '../../../src/providers/abank/rules.ts';
import type { RuleContext, RuleTx } from '../../../src/providers/types.ts';

const ctx: RuleContext = { jarTitles: new Set() };
const tx = (mcc: number | null, description: string, amount = -100): RuleTx => ({ mcc, description, amount, bankCategory: null });

const CASHBACK = 'Зарахування кешбеку на картку';

describe('transfers', () => {
  it('MCC 4829 is a transfer, either way; the cashback credit is not', () => {
    expect(rules.isTransferLike(tx(4829, 'Вигадана Особа'))).toBe(true);
    expect(rules.isTransferLike(tx(4829, 'MONO*VYHADANA OSOBA', 100))).toBe(true);
    expect(rules.isTransferLike(tx(4829, CASHBACK, 100))).toBe(false);
    expect(rules.isTransferLike(tx(6012, 'Вигаданий банк', 100))).toBe(false);
    expect(rules.isTransferLike(tx(5411, 'Вигаданий супермаркет'))).toBe(false);
    expect(rules.isTransferLike(tx(null, 'Вигадана Особа'))).toBe(false);
  });

  it('no own-transfer text is known; a transfer is a person transfer', () => {
    const t = tx(4829, 'Вигадана Особа');
    expect(rules.isOwnTransferText(t, ctx)).toBe(false);
    expect(rules.ownTransferCounterpart(t, ctx)).toBeNull();
    expect(rules.isServiceTransferText(t, ctx)).toBe(false);
    expect(rules.isPersonTransfer(t, ctx)).toBe(true);
    expect(rules.isPersonTransfer(tx(4829, CASHBACK, 100), ctx)).toBe(false);
  });

  it('named senders from Monobank, and income sources', () => {
    expect(rules.namedSender('MONO*VYHADANA OSOBA')).toEqual({ label: 'MONO*', name: 'VYHADANA OSOBA' });
    expect(rules.namedSender('Вигадана Особа')).toBeNull();
    expect(rules.incomeSource(tx(4829, 'MONO*VYHADANA OSOBA', 100))).toBe('named_sender');
    expect(rules.incomeSource(tx(4829, 'Вигадана Особа', 100))).toBe('transfer');
    expect(rules.incomeSource(tx(6012, 'Вигаданий банк', 100))).toBe('other_bank');
    expect(rules.incomeSource(tx(4829, CASHBACK, 100))).toBe('other');
  });
});

describe('refunds and categories', () => {
  it('a cancellation, a credit with a merchant code or without a code is a refund; transfers, cashback, 6012 are not', () => {
    expect(rules.isRefundCredit(tx(5399, 'Скасування. Вигаданий магазин', 100))).toBe(true);
    expect(rules.isRefundCredit(tx(5977, 'Вигаданий магазин', 100))).toBe(true);
    expect(rules.isRefundCredit(tx(null, 'Вигадана аптека, місто', 100))).toBe(true);
    expect(rules.isRefundCredit(tx(4829, 'MONO*VYHADANA OSOBA', 100))).toBe(false);
    expect(rules.isRefundCredit(tx(4829, CASHBACK, 100))).toBe(false);
    expect(rules.isRefundCredit(tx(6012, 'Вигаданий банк', 100))).toBe(false);
    expect(rules.isRefundCredit(tx(5411, 'Вигаданий супермаркет'))).toBe(false);
  });

  it('hints only from the shape: transfers, cashback, a 6012 credit; every merchant code is left to the MCC table', () => {
    expect(rules.categoryHint(tx(4829, 'Вигадана Особа'))).toBe('p2p');
    expect(rules.categoryHint(tx(4829, 'MONO*VYHADANA OSOBA', 100))).toBe('income');
    expect(rules.categoryHint(tx(4829, CASHBACK, 100))).toBe('income');
    expect(rules.categoryHint(tx(6012, 'Вигаданий банк', 100))).toBe('income');
    expect(rules.categoryHint(tx(6012, 'Вигаданий банк'))).toBeNull();
    expect(rules.categoryHint(tx(5977, 'Вигадана аптека'))).toBeNull();
    expect(rules.categoryHint(tx(null, 'Вигаданий магазин'))).toBeNull();
  });

  it('no bank category, no treasury, no business account, no auto top-up', () => {
    expect(rules.knowsBankCategory('Будь-що')).toBe(false);
    expect(rules.isTreasury('Вигаданий платіж')).toBe(false);
    expect(rules.isBusinessAccount({ type: 'card' })).toBe(false);
    expect(rules.isAutoTopUp(tx(4829, 'Вигадана Особа'))).toBe(false);
  });
});

describe('masking', () => {
  it('service texts kept, prefixes kept with the rest replaced, everything else replaced', () => {
    expect(rules.maskDescription(CASHBACK, ctx)).toEqual({ description: CASHBACK, descClass: 'service' });
    expect(rules.maskDescription('Зняття готівки', ctx)).toEqual({ description: 'Зняття готівки', descClass: 'service' });
    expect(rules.maskDescription('Скасування. Вигаданий магазин', ctx)).toEqual({ description: 'Скасування. [other]', descClass: 'service' });
    expect(rules.maskDescription('MONO*VYHADANA OSOBA', ctx)).toEqual({ description: 'MONO*[other]', descClass: 'from_prefix' });
    expect(rules.maskDescription('Вигаданий супермаркет', ctx)).toEqual({ description: '[other]', descClass: 'other' });
  });

  it('never keeps a merchant or a name', () => {
    for (const text of ['Скасування. Вигаданий магазин', 'MONO*VYHADANA OSOBA', 'Вигадана Особа']) {
      const masked = rules.maskDescription(text, ctx).description;
      expect(masked).not.toMatch(/Вигадан|VYHADANA/);
    }
  });
});
