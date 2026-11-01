import type { LimitFiguresView } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { STATE_LOOK } from './constants.ts';
import type { LimitLook, Money } from './types.ts';

/** An amount typed in whole units («4 000», «4000») → minor units; null — not a whole positive number or over `max`. */
export function goalMinor(text: string, max: number): number | null {
  const s = text.trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(s)) return null;
  const k = Number(s) * 100;
  return k > 0 && k <= max ? k : null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * A limit's look from its figures: spent of the amount, the pace marker (a month or a week that runs), the state in
 * words, and «?» explanations with the user's numbers. `running` — the period is the current one.
 */
export function limitLook(f: LimitFiguresView, money: Money, running: boolean): LimitLook {
  const look = STATE_LOOK[f.state];
  const over = f.spent - f.amount;
  const forecastOver = f.forecast !== null && f.forecast > f.amount;
  const stateText =
    f.state === 'exceeded'
      ? t('entities.goal.exceededBy', { amount: money.money(over) })
      : f.state === 'attention'
        ? forecastOver && f.percent < 80
          ? t('entities.goal.forecastOver')
          : t('entities.goal.spentShare', { n: f.percent })
        : t(look.label);
  const showPace = running && f.days > 1;
  return {
    fill: f.amount > 0 ? clamp((f.spent / f.amount) * 100) : 0,
    pace: showPace ? clamp((f.daysPassed / f.days) * 100) : null,
    state: f.state,
    stateText,
    stateIcon: look.icon,
    spentOf: t('entities.goal.spentOf', { spent: money.money(f.spent), amount: money.money(f.amount) }),
    paceText: showPace && f.forecast !== null
      ? t('entities.goal.paceLine', { expected: money.money(f.expected), forecast: money.money(f.forecast) })
      : '',
    perDay: money.money(f.perDay),
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
      forecast: showPace && f.forecast !== null
        ? {
            title: t('entities.goal.help.forecastTitle'),
            lines: [
              t('entities.goal.help.forecast'),
              t('entities.goal.help.forecastFormula', { spent: money.money(f.spent), passed: f.daysPassed, days: f.days, forecast: money.money(f.forecast) }),
              t('entities.goal.help.forecastEarly'),
            ],
          }
        : null,
    },
  };
}
