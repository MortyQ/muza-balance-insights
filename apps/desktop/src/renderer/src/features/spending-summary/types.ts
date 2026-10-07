import type { ComputedRef, Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { CategoryId } from '@contract/categories.ts';
import type { Scope, SpendingOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { Loadable, YearMonth } from '@/shared/lib';
import type { ChangeChipModel, ShareBarSegment } from '@/shared/ui';

/** A change chip (shared/ui `VChangeChip`). */
export type ChipView = ChangeChipModel;

/**
 * `home.spending.ops` and its small difference («+2», `home.spending.opsSame`, `home.spending.change.new`; empty — no
 * comparison); `sr` — the direction for screen readers ('' — none).
 */
export interface OpsView {
  text: string;
  diff: string;
  tone: 'up' | 'down' | 'neutral';
  title: string;
  sr: string;
}

/** A coloured part of a row's bar (`VShareBar`). */
export type BarSegment = ShareBarSegment;

export interface RowView {
  key: string;
  /** The category the row opens (its screen); null — «N more categories» or a word the core no longer has. */
  categoryId: CategoryId | null;
  name: string;
  icon: string;
  color: string;
  share: string;
  amount: string;
  conv: string[];
  ops: OpsView;
  chip: ChipView | null;
  /** % of the largest row (this month or last); mark — last month's position. */
  width: number;
  mark: number | null;
  markTitle: string;
  segments: BarSegment[];
}

export interface PersonRowView {
  /** null — «Whole family». */
  participantId: number | null;
  name: string;
  color: string;
  /** The family row: every person's colour. */
  dots: string[];
  caption: string;
  amount: string;
  chip: ChipView | null;
  pressed: boolean;
}

/** The block's own menu choices (its gear). */
export interface SpendingPrefs {
  split: boolean;
  mark: boolean;
}

/** A person as the block shows them (from the participant store). */
export interface BlockPerson {
  id: number;
  name: string;
  color: string;
}

export interface UseSpendingReturn {
  month: Readonly<Ref<YearMonth>>;
  /** The current local month (the year of `compared` is shown when it differs). */
  thisMonth: Readonly<Ref<YearMonth>>;
  scope: Ref<Scope>;
  state: Readonly<Ref<Loadable<SpendingOverview>>>;
  view: ComputedRef<SpendingOverview | null>;
  periodNote: ComputedRef<string | null>;
  importing: ComputedRef<boolean>;
  /** The global filter is «Whole family» and there is more than one person. */
  family: ComputedRef<boolean>;
  /** One person of a family is picked in the global filter. */
  member: ComputedRef<boolean>;
  people: ComputedRef<ReadonlyArray<BlockPerson>>;
  /** The person the global filter shows (one person of a family, or the only one); null — the whole family. */
  selected: ComputedRef<BlockPerson | null>;
  /** The block's own pick (family view): a participant id or null. */
  pick: Ref<number | null>;
  /** The answer's rates and the home-wide currency choice: every amount of the block goes through it. */
  fmt: ComputedRef<MoneyFormat>;
}

/** A toned difference of operations («+4 vs Aug.», «+2»): `OPS_TONE`, `sr` — the direction for screen readers. */
export type OpsDiffView = Pick<OpsView, 'text' | 'tone' | 'sr'>;

/** A category row with the screen it opens (`categoryLink`); null — «N more categories» or an unknown word. */
export interface CategoryRowView extends RowView {
  to: RouteLocationRaw | null;
}

/** The right column: the rows, or `home.spending.noneBy` for a pick with none ('' otherwise). */
export interface CategoriesView {
  rows: CategoryRowView[];
  none: string;
}

/** The member card: «46% of the family's spending» and «family — 101 830 ₴». */
export interface MemberCardView {
  name: string;
  color: string;
  share: string;
  family: string;
}

/** The left column under the header: everything but the people list. */
export interface SummaryView {
  ring: {
    /** conic-gradient stops (`ringOf`). */
    stops: string;
    /** `who`, or `home.spending.title` for the only person. */
    label: string;
    amount: string;
    perDay: string | null;
    chip: ChipView | null;
    /** «≈» lines. */
    conv: string[];
  };
  compare: {
    /** `home.spending.noCompare`; '' — there is a comparison. */
    none: string;
    /** `home.spending.compareFull`; '' — no comparison. */
    compared: string;
    leftOut: string[];
  };
  stats: {
    ops: number;
    opsVs: OpsDiffView;
    /** «In August» and its total; `title` — the period compared with while this month is in progress (else ''). */
    prev: { label: string; title: string; amount: string } | null;
  };
  member: MemberCardView | null;
}

/** The block's own person pick (family view only). */
export interface UsePickReturn {
  /** The pick, only while it is a person still in the view (one removed meanwhile → the family). */
  blockPick: ComputedRef<number | null>;
  /** «Whole family», the picked person, a family member of the global filter; '' — the only person. */
  who: ComputedRef<string>;
  /** The people list (family view); [] otherwise. */
  people: ComputedRef<PersonRowView[]>;
  onPick: (id: number | null) => void;
}

export interface UseCategoryRowsReturn {
  rows: ComputedRef<RowView[]>;
  categories: ComputedRef<CategoriesView>;
}

export interface UseSummaryViewReturn {
  /** null — no answer yet. */
  summary: ComputedRef<SummaryView | null>;
}

/** The block's display state from `useSpending` and the menu choices: everything the template binds. */
export interface UseSpendingViewReturn {
  /** «September · Whole family». */
  subtitle: ComputedRef<string>;
  /** The month has spending in the family view (the block shows even when a pick has none). */
  hasData: ComputedRef<boolean>;
  /** The month is covered and has no spending (not an error, not before the data). */
  empty: ComputedRef<boolean>;
  leftOut: ComputedRef<string[]>;
  summary: ComputedRef<SummaryView | null>;
  categories: ComputedRef<CategoriesView>;
  people: ComputedRef<PersonRowView[]>;
  onPick: (id: number | null) => void;
}
