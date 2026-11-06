import { i18n, t } from '@/shared/lib';

/** A whole percent with a real minus sign. */
export const percent = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n)}%`;

/** «2.4 mo.» in the screen's language. */
export const monthsText = (n: number) => t('insights.budget.reserveValue', { n: new Intl.NumberFormat(i18n.global.locale.value, { maximumFractionDigits: 1 }).format(n) });
