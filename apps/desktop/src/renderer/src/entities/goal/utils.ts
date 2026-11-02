import type { LimitFiguresView } from '@contract/api.ts';
import { i18n, t } from '@/shared/lib';
import { STATE_LOOK, type StateLookName } from './constants.ts';
import type { LimitLook, Money } from './types.ts';

/** An amount typed in whole units («4 000», «4000») → minor units; null — not a whole positive number or over `max`. */
export function goalMinor(text: string, max: number): number | null {
  const s = text.trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(s)) return null;
  const k = Number(s) * 100;
  return k > 0 && k <= max ? k : null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** «×2.6», one decimal, in the app language's way. */
const times = (n: number) => new Intl.NumberFormat(i18n.global.locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

/** The state in words by its reason (spec desktop-limits-goals): what is wrong, with the user's numbers. */
function stateWords(f: LimitFiguresView, money: Money, running: boolean): { state: StateLookName; text: string } {
  if (f.state === 'exceeded') return { state: 'exceeded', text: t('entities.goal.exceededBy', { amount: money.money(f.spent - f.amount) }) };
  if (f.state === 'attention') {
    const text =
      f.reason === 'pace'
        ? t('entities.goal.ahead', { amount: money.money(f.spent - f.expected), times: times(f.spent / f.expected) })
        : f.reason === 'forecast'
          ? t('entities.goal.forecastOver')
          : t('entities.goal.spentShare', { n: f.percent });
    return { state: 'attention', text };
  }
  if (running && f.pace === 'ahead') return { state: 'ahead', text: t('entities.goal.aheadSoft') };
  if (running && f.pace === 'under') return { state: 'ok', text: t('entities.goal.under', { amount: money.money(f.expected - f.spent) }) };
  return { state: 'ok', text: t(STATE_LOOK.ok.label) };
}

/**
 * A limit's look from its figures: spent of the amount, the pace marker (a month or a week that runs), the state in
 * words, and «?» explanations with the user's numbers. `running` — the period is the current one.
 */
export function limitLook(f: LimitFiguresView, money: Money, running: boolean): LimitLook {
  const words = stateWords(f, money, running);
  const showPace = running && f.days > 1;
  const showForecast = showPace && f.forecast !== null && f.forecastShown;
  return {
    fill: f.amount > 0 ? clamp((f.spent / f.amount) * 100) : 0,
    pace: showPace ? clamp((f.daysPassed / f.days) * 100) : null,
    state: words.state,
    stateText: words.text,
    stateIcon: STATE_LOOK[words.state].icon,
    spentOf: t('entities.goal.spentOf', { spent: money.money(f.spent), amount: money.money(f.amount) }),
    paceText: showForecast
      ? t('entities.goal.paceLine', { expected: money.money(f.expected), forecast: money.money(f.forecast!) })
      : showPace
        ? t('entities.goal.paceLineEarly', { expected: money.money(f.expected) })
        : '',
    perDay: money.money(f.perDay),
    pending: f.pending
      ? { text: t('entities.goal.pending', { n: f.pending.count, amount: money.money(f.pending.amount) }, f.pending.count), hint: t('entities.goal.pendingHint') }
      : null,
    help: {
      perDay: {
        title: t('entities.goal.help.perDayTitle'),
        lines: [
          t('entities.goal.help.perDay'),
          f.left > 0
            ? t('entities.goal.help.perDayFormula', { amount: money.money(f.amount), spent: money.money(f.spent), days: t('entities.goal.days', f.daysLeft), perDay: money.money(f.perDay) })
            : t('entities.goal.help.perDayNone'),
        ],
      },
      expected: showPace
        ? {
            title: t('entities.goal.help.expectedTitle'),
            lines: [
              t('entities.goal.help.expected'),
              t('entities.goal.help.expectedFormula', { amount: money.money(f.amount), passed: f.daysPassed, days: f.days, expected: money.money(f.expected) }),
            ],
          }
        : null,
      forecast: showForecast
        ? {
            title: t('entities.goal.help.forecastTitle'),
            lines: [
              t('entities.goal.help.forecast'),
              t('entities.goal.help.forecastFormula', { spent: money.money(f.spent), passed: f.daysPassed, days: f.days, forecast: money.money(f.forecast!) }),
              t('entities.goal.help.forecastEarly'),
            ],
          }
        : null,
    },
  };
}
