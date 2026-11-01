import type { ComputedRef, Ref } from 'vue';
import type { GoalCurrency, GoalPayload, LimitPeriod, LimitsOverview } from '@contract/api.ts';
import type { KindCategoryId } from '@contract/categories.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { GoalHelp, LimitLook } from '@/entities/goal';
import type { Loadable } from '@/shared/lib';

export interface LimitRowView {
  id: number;
  categoryId: KindCategoryId;
  icon: string;
  name: string;
  period: LimitPeriod;
  periodText: string;
  /** Whose, in a view of several people; null — not said. */
  owner: string | null;
  /** null — no rate for its currency. */
  look: LimitLook | null;
}

export interface FixedRowView {
  categoryId: KindCategoryId;
  name: string;
  icon: string;
  /** «1 250 of 1 250 €». */
  paidOf: string;
  paid: 'yes' | 'part' | 'no';
}

export interface BudgetPanelView {
  id: number;
  title: string;
  total: string;
  fixed: FixedRowView[];
  /** «Paid 1 282 of 1 410 €». */
  fixedSummary: string;
  fixedTakesAll: boolean;
  flexibleTitle: string;
  flexible: LimitLook;
  /** A past month: «Within the budget · 57 € left» / «Over by 65 €»; null while it runs. */
  result: { within: boolean; text: string } | null;
  help: GoalHelp;
}

export interface SuggestionView {
  categoryId: KindCategoryId;
  name: string;
  amount: string;
}

export interface GoalRowView {
  id: number;
  name: string;
  /** Whole per cent for the ring; null — its jar is gone. */
  percent: number | null;
  /** «31 000 of 50 000 ₴ · jar». */
  progress: string;
  /** «by June · 2 715 ₴ a month», «met», «overdue», '' — no date. */
  need: string;
  tone: 'ok' | 'met' | 'late' | 'gone';
  owner: string | null;
  help: GoalHelp | null;
}

export interface LimitsScreenView {
  current: boolean;
  monthTitle: string;
  budget: BudgetPanelView | null;
  limits: LimitRowView[];
  suggestions: SuggestionView[];
  goals: GoalRowView[];
  /** Fewer than 3 whole months: no suggestions yet. */
  early: boolean;
}

/** What a sheet starts from: a saved plan or a new one's defaults; `id` null — new. */
export type SheetStart = { id: number | null; goal: GoalPayload };

export interface UseLimitsGoalsReturn {
  state: Readonly<Ref<Loadable<LimitsOverview>>>;
  view: ComputedRef<LimitsScreenView | null>;
  fmt: ComputedRef<MoneyFormat>;
  /** Whom a plan can belong to, in a family of several; empty — no choice. */
  owners: ComputedRef<Array<{ id: number; name: string }>>;
  defaultOwner: ComputedRef<number | null>;
  defaultCurrency: ComputedRef<GoalCurrency>;
  save: (id: number | null, g: GoalPayload) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
  addSuggested: () => Promise<boolean>;
}
