// Slovenská sporiteľňa's rules (src/providers/slsp/rules.ts): the operation type (the bank category) tells transfers,
// cash and refunds, merchant keywords categorise card payments; masking keeps no text. Fictional texts only.
import { describe, expect, it } from 'vitest';
import { merchantHint } from '../../../src/providers/slsp/merchants.ts';
import { slspRules as rules } from '../../../src/providers/slsp/rules.ts';
import type { RuleContext, RuleTx } from '../../../src/providers/types.ts';

const ctx: RuleContext = { jarTitles: new Set() };
const tx = (bankCategory: string | null, description: string, amount = -100): RuleTx => ({ mcc: null, description, amount, bankCategory });

const IN = 'Prijatá Okamžitá platba';
const OUT = 'Okamžitá platba (elektronicky)';
const CARD = 'Platba kartou';

describe('types', () => {
  it('the four transfer types are transfers to and from people, by sign', () => {
    for (const type of [IN, OUT, 'SEPA platba (elektronicky)', 'Prijatá SEPA platba']) {
      expect(rules.isTransferLike(tx(type, 'Vymyslená Osoba'))).toBe(true);
      expect(rules.isPersonTransfer(tx(type, 'Vymyslená Osoba'), ctx)).toBe(true);
    }
    expect(rules.categoryHint(tx(IN, 'Vymyslená Osoba', 500))).toBe('income');
    expect(rules.categoryHint(tx(OUT, 'BILLA Vymyslená'))).toBe('p2p');
    expect(rules.incomeSource(tx(IN, 'Vymyslená Osoba', 500))).toBe('transfer');
    expect(rules.isTransferLike(tx(CARD, 'BILLA 1'))).toBe(false);
  });

  it('no own-transfer text: own transfers come from the IBAN rule', () => {
    const t = tx(OUT, 'Vymyslená Osoba');
    expect(rules.isOwnTransferText(t, ctx)).toBe(false);
    expect(rules.ownTransferCounterpart(t, ctx)).toBeNull();
    expect(rules.isServiceTransferText(t, ctx)).toBe(false);
    expect(rules.namedSender('Vymyslená Osoba')).toBeNull();
  });

  it('a withdrawal is cash, a deposit income; a returned purchase is a refund, a deposit is not', () => {
    expect(rules.categoryHint(tx('Výber kartou', 'Vymyslená banka'))).toBe('cash');
    expect(rules.categoryHint(tx('Vklad cez ATM', 'Vymyslený bankomat', 1000))).toBe('income');
    expect(rules.isRefundCredit(tx('Vklad cez ATM', 'Vymyslený bankomat', 1000))).toBe(false);
    expect(rules.isRefundCredit(tx('Návrat tovaru', 'BILLA 7', 300))).toBe(true);
    expect(rules.isRefundCredit(tx(IN, 'Vymyslená Osoba', 300))).toBe(false);
    expect(rules.isRefundCredit(tx(CARD, 'BILLA 7'))).toBe(false);
    expect(rules.incomeSource(tx('Vklad cez ATM', 'Vymyslený bankomat', 1000))).toBe('other');
  });

  it('a refund takes its merchant category; an unknown type is unknown and falls to the keywords', () => {
    expect(rules.categoryHint(tx('Návrat tovaru', 'LIDL DAKUJE 9', 300))).toBe('groceries');
    expect(rules.knowsBankCategory('Vymyslený typ')).toBe(false);
    expect(rules.knowsBankCategory(CARD)).toBe(true);
    expect(rules.categoryHint(tx('Vymyslený typ', 'Vymyslený obchod'))).toBeNull();
    expect(rules.categoryHint(tx(null, 'IKEA Vymyslená'))).toBe('home');
  });

  it('nothing is treasury or business; every description is masked', () => {
    expect(rules.isTreasury('BILLA 1')).toBe(false);
    expect(rules.isBusinessAccount({ type: 'card' })).toBe(false);
    expect(rules.maskDescription('Vymyslená Osoba', ctx)).toEqual({ description: '[other]', descClass: 'other' });
  });
});

describe('merchant keywords', () => {
  it('a chain by its name, anywhere in the text', () => {
    expect(merchantHint('BILLA 113')).toBe('groceries');
    expect(merchantHint('9999 TERNO VYMYSLENA-MESTO')).toBe('groceries');
    expect(merchantHint('BOLT.EU/O/2601011200-TALLINN')).toBe('transport');
    expect(merchantHint("MCDONALD'S-MESTO")).toBe('cafes');
    expect(merchantHint('DR.MAX 9, VYMYSLENA')).toBe('health');
    expect(merchantHint('CINEMACITY.SK/-MESTO')).toBe('entertainment');
    expect(merchantHint('GOOGLE *YOUTUBEPREMIUM-LONDON')).toBe('entertainment');
  });

  it('a kiosk named after a supermarket is not groceries', () => {
    expect(merchantHint('TABAK-PRESS-BILLA VYMYSL.')).toBeNull();
    expect(merchantHint('GECO TABAK, MESTO')).toBeNull();
  });

  it('whole words only: a keyword inside a longer word does not match', () => {
    expect(merchantHint('BOLTON VYMYSLENY')).toBeNull();
    expect(merchantHint('APTEKAVYMYSLENA')).toBeNull();
  });

  it('a first-word entry matches only at the start', () => {
    expect(merchantHint('DM 999 MESTO')).toBe('beauty');
    expect(merchantHint('VYMYSLENY DM OBCHOD')).toBeNull();
  });

  it('case and diacritics do not matter', () => {
    expect(merchantHint('lekáreň Vymyslená')).toBe('health');
    expect(merchantHint('Petržalská plaváreň')).toBe('sport');
  });

  it('an unknown merchant has no hint', () => {
    expect(merchantHint('VYMYSLENA KAVIAREN')).toBeNull();
    expect(merchantHint('')).toBeNull();
  });
});
