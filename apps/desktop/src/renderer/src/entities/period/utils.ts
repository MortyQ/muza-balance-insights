import { monthOf, type YearMonth } from '@/shared/lib';

/** The first month with data (Kyiv) from the sync status's first data date; null while unknown. */
export function firstMonthOf(dataFrom: string | null | undefined): YearMonth | null {
  return dataFrom ? monthOf(dataFrom) : null;
}
