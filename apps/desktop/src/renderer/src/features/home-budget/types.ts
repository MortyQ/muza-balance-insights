import type { ComputedRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { LimitLook } from '@/entities/goal';

export interface FixedChipView {
  key: string;
  name: string;
  /** «✓», «12/30» or «—». */
  mark: string;
  paid: boolean;
}

/** Home's «Budget» row: the four parts of a running month, or a past month's result. */
export interface BudgetRowView {
  title: string;
  total: string;
  fixedTitle: string;
  /** Paid share of the fixed costs, 0–100. */
  fixedPaid: number;
  fixed: FixedChipView[];
  flexibleTitle: string;
  flexible: LimitLook;
  /** A running month: per day by the budget and the days left. */
  perDay: { amount: string; days: string } | null;
  result: { within: boolean; text: string; left: string } | null;
}

/** A limit that needs attention, for the «Limits» slide. */
export interface AttentionLimitView {
  id: number;
  icon: string;
  name: string;
  look: LimitLook;
}

export interface UseHomeBudgetReturn {
  /** null — nothing to show (a past month without a budget, or not loaded). */
  row: ComputedRef<BudgetRowView | null>;
  /** The current month without a budget: the empty row. */
  empty: ComputedRef<boolean>;
  /** Limits in attention or exceeded, exceeded first; the current month only. */
  attention: ComputedRef<AttentionLimitView[]>;
  anyExceeded: ComputedRef<boolean>;
  budgetTo: RouteLocationRaw;
  setTo: RouteLocationRaw;
}
