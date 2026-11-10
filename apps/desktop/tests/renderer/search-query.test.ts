// The global search's input taken apart (shared/lib searchQuery.ts, spec desktop-global-search): dates in English,
// Ukrainian and Russian, one amount, the text left.
import { describe, expect, it } from 'vitest';
import { parseSearch } from '@/shared/lib';

const TODAY = '2026-11-10';
const p = (s: string) => parseSearch(s, TODAY);

describe('parseSearch', () => {
  it('plain text: spaces folded, no dates, no amount', () => {
    expect(p('  Fictional   Market ')).toEqual({ text: 'Fictional Market', from: null, to: null, amount: null });
    expect(p('')).toEqual({ text: '', from: null, to: null, amount: null });
  });

  it('one day: «12 Oct», in any of the three languages, with or without a year', () => {
    for (const s of ['12 Oct', '12 oct.', '12 October', '12 жовт', '12 жовтня', '12 окт', '12 октября']) {
      expect(p(s), s).toEqual({ text: '', from: '2026-10-12', to: '2026-10-12', amount: null });
    }
    expect(p('12 Oct 2025')).toMatchObject({ from: '2025-10-12', to: '2025-10-12' });
    // A day still to come this year is last year's.
    expect(p('12 Dec')).toMatchObject({ from: '2025-12-12', to: '2025-12-12' });
    expect(p('10 Nov')).toMatchObject({ from: '2026-11-10' });
  });

  it('a range: «5–11 Oct», any dash, and across months', () => {
    for (const s of ['5–11 Oct', '5-11 Oct', '5 — 11 жовтня', '5-11 окт']) {
      expect(p(s), s).toMatchObject({ from: '2026-10-05', to: '2026-10-11', text: '' });
    }
    expect(p('28 Oct – 3 Nov')).toMatchObject({ from: '2026-10-28', to: '2026-11-03' });
    expect(p('28 Dec – 3 Jan')).toMatchObject({ from: '2025-12-28', to: '2026-01-03' });
    // Backwards is no range: only the day next to the month is taken.
    expect(p('11–5 Oct')).toMatchObject({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('a month: «October 2026», «Oct 2026», a full name alone; a short name alone stays text', () => {
    expect(p('October 2026')).toMatchObject({ from: '2026-10-01', to: '2026-10-31', text: '' });
    expect(p('лют 2024')).toMatchObject({ from: '2024-02-01', to: '2024-02-29' });
    expect(p('жовтень')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(p('декабрь')).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
    expect(p('лист')).toEqual({ text: 'лист', from: null, to: null, amount: null });
  });

  it('a day that does not exist is no date: the number is an amount, the month a word', () => {
    expect(p('31 Feb')).toEqual({ from: null, to: null, text: 'Feb', amount: 31 });
  });

  it('the amount: one number, a comma or a dot; two numbers are text', () => {
    expect(p('250')).toEqual({ text: '', from: null, to: null, amount: 250 });
    expect(p('250,50')).toMatchObject({ amount: 250.5 });
    expect(p('Cafe 250.5')).toEqual({ text: 'Cafe', from: null, to: null, amount: 250.5 });
    expect(p('250 300')).toMatchObject({ amount: null, text: '250 300' });
  });

  it('all together: text, a date and an amount', () => {
    expect(p('Сільпо 12 жовт 250')).toEqual({ text: 'Сільпо', from: '2026-10-12', to: '2026-10-12', amount: 250 });
    expect(p('Fictional Market October 2026')).toEqual({ text: 'Fictional Market', from: '2026-10-01', to: '2026-10-31', amount: null });
  });
});
